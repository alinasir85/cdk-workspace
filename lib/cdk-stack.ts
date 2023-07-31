import {Stack, StackProps} from 'aws-cdk-lib';
import {Construct} from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import {LambdaIntegration, LambdaRestApi, RestApi} from 'aws-cdk-lib/aws-apigateway';
import {HitCounter} from './constructs/HitCounter';
import {OpenSearchWithCloudWatch, OpenSearchWithCloudWatchProps} from "./constructs/OpenSearchWithCloudWatch";
import {APIGateway} from "aws-sdk";
import {LogMiddlewareLayerFactory} from "./factories/LogMiddlewareLayerFactory";

export class CdkStack extends Stack {
    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        const logLayer = new LogMiddlewareLayerFactory(this,"LogLayer");

        const hitCounterWithDownstreamHandler = new HitCounter(this, 'hitCounterWithDownstreamHandler',logLayer.getLayer());
        new LambdaRestApi(this, 'Endpoint', {
            handler: hitCounterWithDownstreamHandler.handler
        });

        /*        enableCloudWatchLogs().then(_resp => {
            const openSearchProps: OpenSearchWithCloudWatchProps = {
                domainName: 'cdk-work',
                username: 'admin',
                password: 'Temp/123',
            };
            new OpenSearchWithCloudWatch(this, 'OpenSearchWithCloudWatch', openSearchProps);
        });

        // The Lambda function
        const getCallLogsLambda = new lambda.Function(this, 'GetCallLogsLambda', {
            code: lambda.Code.fromAsset('lambda'),
            handler: 'openSearchQueryHandler.handler',
            runtime: lambda.Runtime.NODEJS_18_X,
            environment: {
                OPENSEARCH_ENDPOINT: 'https://search-cdk-work-beeunexiue2ri37xfad4quilmy.us-east-1.es.amazonaws.com',
                OPENSEARCH_USERNAME: 'admin',
                OPENSEARCH_PASSWORD: 'Temp/123',
            },
        });
        // The API Gateway REST API
        const api = new RestApi(this, 'LogsAPI', {
            restApiName: 'LogsAPI',
            description: 'This service serves logs.',
        });
        // The GET /getCallLogs endpoint
        const getCallLogsIntegration = new LambdaIntegration(getCallLogsLambda);
        api.root.addResource('getCallLogs').addMethod('GET', getCallLogsIntegration);*/
    }
}


const enableCloudWatchLogs = async () => {
    try {
        const apigateway = new APIGateway();
        const apis = await apigateway.getRestApis().promise();
        if (apis.items) {
            for (const item of apis.items) {
                const restApiId = item.id;
                console.log("restApiId: ",restApiId)
                if (restApiId) {
                    const stages = await apigateway.getStages({restApiId}).promise();
                    if (stages.item) {
                        for (const stage of stages.item) {
                            const stageName = stage.stageName;
                            if (stageName) {
                                const params: APIGateway.UpdateStageRequest = {
                                    restApiId: restApiId,
                                    stageName: stageName,
                                    patchOperations: [
                                        {
                                            op: 'replace',
                                            path: '/*/*/logging/dataTrace',
                                            value: 'true',
                                        },
                                        {
                                            op: 'replace',
                                            path: '/*/*/logging/loglevel',
                                            value: 'INFO',
                                        },
                                        {
                                            op: 'replace',
                                            path: '/*/*/metrics/enabled',
                                            value: 'true',
                                        },
                                    ],
                                };
                                await apigateway.updateStage(params).promise();
                            }
                        }
                    }
                }
            }
        }
    } catch (err) {
        console.error(err);
    }
};

