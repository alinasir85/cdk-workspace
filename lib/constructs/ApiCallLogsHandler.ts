import {Function, Runtime} from 'aws-cdk-lib/aws-lambda';
import {Construct} from 'constructs';
import * as path from "path";
import {Duration} from "aws-cdk-lib";
import {NodejsFunction} from "aws-cdk-lib/aws-lambda-nodejs";

export class ApiCallLogsHandler extends Construct {
    public readonly handler: Function;
    constructor(scope: Construct, id: string) {
        super(scope, id);
        this.handler = new NodejsFunction(
            this,
            "ApiCallLogsHandler",
            {
                entry: path.join(__dirname, "../../lambda/application/getApiCallLogs/index.ts"),
                handler: "handler",
                runtime: Runtime.NODEJS_16_X,
                timeout: Duration.seconds(5),
            }
        );
    }
}
