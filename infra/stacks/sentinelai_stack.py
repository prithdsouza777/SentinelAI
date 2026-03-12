"""SentinelAI AWS CDK Stack.

Provisions: DynamoDB tables, Redis (ElastiCache), Lambda functions,
EventBridge rules, and IAM roles for the SentinelAI platform.
"""

from constructs import Construct
import aws_cdk as cdk
import aws_cdk.aws_dynamodb as dynamodb
import aws_cdk.aws_elasticache as elasticache
import aws_cdk.aws_ec2 as ec2
import aws_cdk.aws_lambda as _lambda
import aws_cdk.aws_events as events
import aws_cdk.aws_events_targets as targets
import aws_cdk.aws_iam as iam


class SentinelAIStack(cdk.Stack):
    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # ── VPC ──
        self.vpc = ec2.Vpc(
            self,
            "SentinelVpc",
            max_azs=2,
            nat_gateways=1,
        )

        # ── Security Groups ──
        self.redis_sg = ec2.SecurityGroup(
            self,
            "RedisSG",
            vpc=self.vpc,
            description="Allow Redis access from Lambda",
            allow_all_outbound=True,
        )
        self.redis_sg.add_ingress_rule(
            ec2.Peer.ipv4(self.vpc.vpc_cidr_block),
            ec2.Port.tcp(6379),
            "Redis from VPC",
        )

        self.lambda_sg = ec2.SecurityGroup(
            self,
            "LambdaSG",
            vpc=self.vpc,
            description="Lambda security group",
            allow_all_outbound=True,
        )

        # ── DynamoDB Tables ──

        self.metrics_table = dynamodb.Table(
            self,
            "MetricsTable",
            table_name="sentinelai-metrics",
            partition_key=dynamodb.Attribute(
                name="queue_id", type=dynamodb.AttributeType.STRING
            ),
            sort_key=dynamodb.Attribute(
                name="timestamp", type=dynamodb.AttributeType.STRING
            ),
            billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
            removal_policy=cdk.RemovalPolicy.DESTROY,
        )

        self.decisions_table = dynamodb.Table(
            self,
            "DecisionsTable",
            table_name="sentinelai-decisions",
            partition_key=dynamodb.Attribute(
                name="id", type=dynamodb.AttributeType.STRING
            ),
            sort_key=dynamodb.Attribute(
                name="timestamp", type=dynamodb.AttributeType.STRING
            ),
            billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
            removal_policy=cdk.RemovalPolicy.DESTROY,
        )

        self.alerts_table = dynamodb.Table(
            self,
            "AlertsTable",
            table_name="sentinelai-alerts",
            partition_key=dynamodb.Attribute(
                name="id", type=dynamodb.AttributeType.STRING
            ),
            sort_key=dynamodb.Attribute(
                name="timestamp", type=dynamodb.AttributeType.STRING
            ),
            billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
            removal_policy=cdk.RemovalPolicy.DESTROY,
        )

        self.policies_table = dynamodb.Table(
            self,
            "PoliciesTable",
            table_name="sentinelai-policies",
            partition_key=dynamodb.Attribute(
                name="id", type=dynamodb.AttributeType.STRING
            ),
            billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
            removal_policy=cdk.RemovalPolicy.DESTROY,
        )

        # ── ElastiCache (Redis) ──

        self.redis_subnet_group = elasticache.CfnSubnetGroup(
            self,
            "RedisSubnetGroup",
            description="Subnet group for SentinelAI Redis",
            subnet_ids=[s.subnet_id for s in self.vpc.private_subnets],
            cache_subnet_group_name="sentinelai-redis-subnets",
        )

        self.redis_cluster = elasticache.CfnCacheCluster(
            self,
            "RedisCluster",
            cluster_name="sentinelai-cache",
            engine="redis",
            cache_node_type="cache.t3.micro",
            num_cache_nodes=1,
            cache_subnet_group_name=self.redis_subnet_group.cache_subnet_group_name,
            vpc_security_group_ids=[self.redis_sg.security_group_id],
        )
        self.redis_cluster.add_dependency(self.redis_subnet_group)

        # ── IAM Roles ──

        self.lambda_role = iam.Role(
            self,
            "SentinelLambdaRole",
            role_name="sentinelai-lambda-role",
            assumed_by=iam.ServicePrincipal("lambda.amazonaws.com"),
            managed_policies=[
                iam.ManagedPolicy.from_aws_managed_policy_name(
                    "service-role/AWSLambdaVPCAccessExecutionRole"
                ),
            ],
        )

        # Bedrock access
        self.lambda_role.add_to_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=[
                    "bedrock:InvokeModel",
                    "bedrock:InvokeModelWithResponseStream",
                ],
                resources=["*"],
            )
        )

        # Connect read access
        self.lambda_role.add_to_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=[
                    "connect:GetCurrentMetricData",
                    "connect:GetMetricDataV2",
                    "connect:ListQueues",
                    "connect:DescribeInstance",
                    "connect:UpdateUserRoutingProfile",
                ],
                resources=["*"],
            )
        )

        # DynamoDB access for all tables
        for table in [self.metrics_table, self.decisions_table,
                      self.alerts_table, self.policies_table]:
            table.grant_read_write_data(self.lambda_role)

        # ── Lambda: Connect Event Processor ──

        self.connect_processor = _lambda.Function(
            self,
            "ConnectEventProcessor",
            function_name="sentinelai-connect-processor",
            runtime=_lambda.Runtime.PYTHON_3_12,
            handler="index.handler",
            code=_lambda.Code.from_inline(
                'def handler(event, context):\n'
                '    """Process Connect events and store metrics."""\n'
                '    print(f"Received event: {event}")\n'
                '    return {"statusCode": 200}\n'
            ),
            role=self.lambda_role,
            vpc=self.vpc,
            security_groups=[self.lambda_sg],
            timeout=cdk.Duration.seconds(30),
            memory_size=256,
            environment={
                "METRICS_TABLE": self.metrics_table.table_name,
                "DECISIONS_TABLE": self.decisions_table.table_name,
                "ALERTS_TABLE": self.alerts_table.table_name,
            },
        )

        # ── Lambda: Metric Collector (scheduled) ──

        self.metric_collector = _lambda.Function(
            self,
            "MetricCollector",
            function_name="sentinelai-metric-collector",
            runtime=_lambda.Runtime.PYTHON_3_12,
            handler="index.handler",
            code=_lambda.Code.from_inline(
                'def handler(event, context):\n'
                '    """Collect current metrics from Connect and push to DynamoDB."""\n'
                '    print("Collecting metrics...")\n'
                '    return {"statusCode": 200}\n'
            ),
            role=self.lambda_role,
            vpc=self.vpc,
            security_groups=[self.lambda_sg],
            timeout=cdk.Duration.seconds(60),
            memory_size=256,
            environment={
                "METRICS_TABLE": self.metrics_table.table_name,
            },
        )

        # ── EventBridge: Scheduled metric collection every 30 seconds ──

        self.metric_schedule = events.Rule(
            self,
            "MetricCollectionSchedule",
            rule_name="sentinelai-metric-collection",
            schedule=events.Schedule.rate(cdk.Duration.minutes(1)),
            targets=[targets.LambdaFunction(self.metric_collector)],
        )

        # ── Outputs ──

        cdk.CfnOutput(self, "RedisEndpoint",
                       value=self.redis_cluster.attr_redis_endpoint_address,
                       description="Redis cluster endpoint")

        cdk.CfnOutput(self, "MetricsTableName",
                       value=self.metrics_table.table_name,
                       description="DynamoDB metrics table")

        cdk.CfnOutput(self, "ConnectProcessorArn",
                       value=self.connect_processor.function_arn,
                       description="Connect event processor Lambda ARN")
