import { Code, Function, IFunction, Runtime } from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import * as sns from 'aws-cdk-lib/aws-sns';

export interface HitCounterProps {
    downstream: IFunction;
    snsTopic: sns.Topic;
}

export class HitCounter extends Construct {
    public readonly handler: Function;
    constructor(scope: Construct, id: string, props: HitCounterProps) {
        super(scope, id);
        this.handler = new Function(this, 'HitCounterHandler', {
            runtime: Runtime.NODEJS_18_X,
            handler: 'hitCounterPrisma.handler',
            code: Code.fromAsset('lambda'),
            environment: {
                DOWNSTREAM_FUNCTION_NAME: props.downstream.functionName,
                HITS_TOPIC_ARN: props.snsTopic.topicArn,
            }
        });
        props.downstream.grantInvoke(this.handler);
    }
}
