import {Function, Runtime} from 'aws-cdk-lib/aws-lambda';
import {Construct} from 'constructs';
import * as path from "path";
import {Duration} from "aws-cdk-lib";
import {NodejsFunction} from "aws-cdk-lib/aws-lambda-nodejs";

export class HitCounterHandler extends Construct {
    public readonly handler: Function;
    constructor(scope: Construct, id: string, props: any) {
        super(scope, id);
        this.handler = new NodejsFunction(
            this,
            "HitCounterHandler",
            {
                entry: path.join(__dirname, "../../lambda/application/hitCounterPrisma/index.ts"),
                layers: [props.logLayer],
                handler: "handler",
                runtime: Runtime.NODEJS_16_X,
                timeout: Duration.seconds(5),
                bundling: {
                    minify: true
                }
            }
        );
    }
}
