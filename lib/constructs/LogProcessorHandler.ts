import {Construct} from "constructs";
import {CfnPermission, Function, Runtime} from "aws-cdk-lib/aws-lambda";
import {Effect, PolicyStatement} from "aws-cdk-lib/aws-iam";
import {NodejsFunction} from "aws-cdk-lib/aws-lambda-nodejs";
import * as path from "path";
import {Duration} from "aws-cdk-lib";

export class LogProcessorLambda extends Construct {

    public readonly handler: Function;

    constructor(scope: Construct, id: string, openSearchDomainArn: string) {
        super(scope, id);
        this.handler = new NodejsFunction(
            this,
            "logProcessorHandler",
            {
                entry: path.join(__dirname, "../../lambda/application/logProcessorHandler/index.ts"),
                handler: "handler",
                runtime: Runtime.NODEJS_16_X,
                timeout: Duration.seconds(5),
                bundling: {
                    minify: true
                }
            }
        );
        this.handler.addToRolePolicy(new PolicyStatement({
            effect: Effect.ALLOW,
            actions: ['es:ESHttp*'],
            resources: [`${openSearchDomainArn}/*`],
        }));
        new CfnPermission(this, 'AllowCloudWatchLogs', {
            action: 'lambda:InvokeFunction',
            principal: 'logs.amazonaws.com',
            functionName: this.handler.functionArn,
        });
    }
}