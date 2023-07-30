import * as iam from 'aws-cdk-lib/aws-iam';
import {Construct} from "constructs";
import {NodejsFunction} from "aws-cdk-lib/aws-lambda-nodejs";
import {Runtime} from "aws-cdk-lib/aws-lambda";

export class LogProcessorLambda extends NodejsFunction {
    constructor(scope: Construct, id: string, openSearchDomainArn: string) {
        super(scope, id, {
            entry: 'lambda/index.js',
            handler: 'handler',
            runtime: Runtime.NODEJS_16_X,
        });
        this.addToRolePolicy(
            new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: ['es:ESHttp*'],
                resources: [`${openSearchDomainArn}/*`],
            })
        );
    }
}