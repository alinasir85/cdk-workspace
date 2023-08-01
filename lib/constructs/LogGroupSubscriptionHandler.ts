import {Function, Runtime} from 'aws-cdk-lib/aws-lambda';
import {Construct} from "constructs";
import {Effect, PolicyStatement, ServicePrincipal} from "aws-cdk-lib/aws-iam";
import {NodejsFunction} from "aws-cdk-lib/aws-lambda-nodejs";
import {Duration} from "aws-cdk-lib";
import * as path from "path";
import {LogProcessorLambda} from "./LogProcessorHandler";

export class LogGroupSubscriptionHandlerLambda extends Construct {

    public readonly handler: Function;

    constructor(scope: Construct, id: string, props: any) {
        super(scope, id);
        const logProcessorLambda = new LogProcessorLambda(this, `logProcessorLambda`, props.openSearchDomainArn);
        this.handler = new NodejsFunction(this, 'LogGroupSubscriptionHandlerLambda', {
            entry: path.join(__dirname, "../../lambda/application/logGroupSubscription/index.ts"),
            runtime: Runtime.NODEJS_16_X,
            handler: 'handler',
            timeout: Duration.seconds(30),
            bundling: {
                minify: true
            },
            environment: {
                LOG_PROCESSOR_LAMBDA_ARN: logProcessorLambda.handler.functionArn
            }
        });

        this.handler.addToRolePolicy(new PolicyStatement({
            actions: [
                'logs:DescribeLogGroups',
                'logs:DescribeSubscriptionFilters'
            ],
            resources: ['*'],
        }));
        this.handler.addToRolePolicy(new PolicyStatement({
            actions: ['logs:PutSubscriptionFilter','logs:DescribeSubscriptionFilters'],
            resources: ['arn:aws:logs:*:*:log-group:*'],
        }));

        logProcessorLambda.handler.grantInvoke(this.handler);
    }
}
