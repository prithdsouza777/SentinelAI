#!/usr/bin/env python3
import aws_cdk as cdk

from stacks.sentinelai_stack import SentinelAIStack

app = cdk.App()
SentinelAIStack(app, "SentinelAIStack")
app.synth()
