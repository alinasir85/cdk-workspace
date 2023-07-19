import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import {LambdaRestApi} from "aws-cdk-lib/aws-apigateway";
import {HitCounter} from "./hitcounter";

export class CdkStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);
    const hello = new lambda.Function(this, 'HelloHandler', {
      runtime: lambda.Runtime.NODEJS_18_X,
      code: lambda.Code.fromAsset('lambda'),
      handler: 'hello.handler'
    });
    const helloWithCounter = new HitCounter(this,'HelloHitCounter', {
      downstream: hello
    })
    new LambdaRestApi(this,'Endpoint',{
      handler: helloWithCounter.handler
    })
  }
}
