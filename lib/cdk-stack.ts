import {Stack, StackProps} from 'aws-cdk-lib';
import {Construct} from 'constructs';
import {LambdaIntegration, LambdaRestApi, RestApi} from 'aws-cdk-lib/aws-apigateway';
import {HitCounterHandler} from './constructs/HitCounterHandler';
import {OpenSearchCloudWatchHandler, OpenSearchWithCloudWatchProps} from "./constructs/OpenSearchCloudWatchHandler";
import {LogMiddlewareLayerFactory} from "./factories/LogMiddlewareLayerFactory";
import {ApiCallLogsHandler} from "./constructs/ApiCallLogsHandler";
import {HelloHandler} from "./constructs/HelloHandler";

export class CdkStack extends Stack {
    constructor(scope: Construct, id: string, props?: StackProps) {

        super(scope, id, props);

        const logLayer = new LogMiddlewareLayerFactory(this,"LogLayer");

        const hitCounterWithDownstreamHandler = new HitCounterHandler(this, 'hitCounterWithDownstreamHandler',{
            logLayer: logLayer.getLayer()
        });
        new LambdaRestApi(this, 'Endpoint', {
            handler: hitCounterWithDownstreamHandler.handler
        });

        const helloHandler = new HelloHandler(this, 'helloHandler',{
            logLayer: logLayer.getLayer()
        });
        new LambdaRestApi(this, 'helloEndpoint', {
            handler: helloHandler.handler
        });

        const apiCallLogsHandler = new ApiCallLogsHandler(this, "ApiCallLogsHandler");
        const api = new RestApi(this, 'getCallLogsAPI', {
            restApiName: 'getCallLogsAPI',
            description: 'This service serves logs.',
        });
        api.root.addResource('getCallLogs').addMethod('GET', new LambdaIntegration(apiCallLogsHandler.handler));

        const openSearchProps: OpenSearchWithCloudWatchProps = {
            domainName: 'cdk-work',
            username: 'admin',
            password: 'Temp/123',
        };
        new OpenSearchCloudWatchHandler(this, 'OpenSearchCloudWatchHandler', openSearchProps);

    }
}

