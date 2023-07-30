import { Function, Runtime } from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import path from "path";
import {Duration} from "aws-cdk-lib";
import {NodejsFunction} from "aws-cdk-lib/aws-lambda-nodejs";

export class HitCounter extends Construct {
    public readonly handler: Function;
    constructor(scope: Construct, id: string) {
        super(scope, id);
        this.handler = new NodejsFunction(
            this,
            "HitCounterHandler",
            {
                entry: path.join(__dirname, "application/hitCounterPrisma/index.ts"),
                handler: "handler",
                runtime: Runtime.NODEJS_18_X,
                timeout: Duration.seconds(5),
                bundling: {
                    minify: true
                }
            }
        );
    }
}
