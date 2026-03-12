"""SentinelAI AWS CDK Stack.

Provisions: DynamoDB tables, Redis (ElastiCache), Lambda functions,
EventBridge rules, and IAM roles for the SentinelAI platform.
"""

from constructs import Construct
import aws_cdk as cdk
import aws_cdk.aws_dynamodb as dynamodb


class SentinelAIStack(cdk.Stack):
    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # ── DynamoDB Tables ──

        # Historical metrics
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

        # AI decision log
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

        # Alerts
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

        # NL Policies
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

        # TODO: Add ElastiCache (Redis) cluster
        # TODO: Add Lambda functions for Connect event processing
        # TODO: Add EventBridge rules for scheduled metric collection
        # TODO: Add IAM roles for Connect API access + Bedrock access
