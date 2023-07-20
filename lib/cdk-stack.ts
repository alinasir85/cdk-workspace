import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as subs from 'aws-cdk-lib/aws-sns-subscriptions';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { LambdaRestApi } from 'aws-cdk-lib/aws-apigateway';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import {Effect, PolicyStatement, ServicePrincipal} from 'aws-cdk-lib/aws-iam';
import { HitCounter } from './hitcounter';

export class CdkStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);
    const queue = new sqs.Queue(this, 'ResponseQueue');
    const snsTopic = new sns.Topic(this, 'HitCounterTopic');
    snsTopic.addSubscription(new subs.SqsSubscription(queue));

    const responseHandler = new lambda.Function(this, 'responseHandler', {
      runtime: lambda.Runtime.NODEJS_18_X,
      code: lambda.Code.fromAsset('lambda'),
      handler: 'response.handler',
    });
    responseHandler.addEventSource(new lambdaEventSources.SqsEventSource(queue));
    queue.grantConsumeMessages(responseHandler);

    const hitCounterWithDownstreamHandler = new HitCounter(this, 'hitCounterWithDownstreamHandler', {
      downstream: responseHandler,
      snsTopic,
    });
    hitCounterWithDownstreamHandler.handler.addToRolePolicy(new PolicyStatement({
      actions: ['sns:Publish'],
      resources: [snsTopic.topicArn],
    }));
    hitCounterWithDownstreamHandler.handler.addEnvironment('HITS_TOPIC_ARN', snsTopic.topicArn);

    new LambdaRestApi(this, 'Endpoint', {
      handler: hitCounterWithDownstreamHandler.handler,
    });
  }
}
