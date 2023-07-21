import { Code, Function, IFunction, Runtime } from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import { RemovalPolicy } from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subs from 'aws-cdk-lib/aws-sns-subscriptions';

export interface HitCounterProps {
    downstream: IFunction;
    snsTopic: sns.Topic;
}

export class HitCounter extends Construct {
    public readonly handler: Function;
    constructor(scope: Construct, id: string, props: HitCounterProps) {
        super(scope, id);
        const table = new dynamodb.Table(this, 'Hits', {
            partitionKey: { name: 'id', type: dynamodb.AttributeType.NUMBER },
            removalPolicy: RemovalPolicy.DESTROY,
        });
        this.handler = new Function(this, 'HitCounterHandler', {
            runtime: Runtime.NODEJS_18_X,
            handler: 'hitCounterDynamo.handler',
            code: Code.fromAsset('lambda'),
            environment: {
                HITS_TABLE_NAME: table.tableName,
                HITS_TOPIC_ARN: props.snsTopic.topicArn,
            },
        });
        table.grantReadWriteData(this.handler);
    }
}
