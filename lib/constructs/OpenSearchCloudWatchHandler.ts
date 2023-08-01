import { aws_opensearchservice as opensearch, Stack } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import {AnyPrincipal, Effect, Policy, PolicyStatement, Role, ServicePrincipal} from 'aws-cdk-lib/aws-iam';
import * as AWS from 'aws-sdk';
import { LogGroupSubscriptionHandlerLambda } from './LogGroupSubscriptionHandler';
import {APIGateway, Lambda} from 'aws-sdk';
import { Rule } from 'aws-cdk-lib/aws-events';
import {LambdaFunction} from "aws-cdk-lib/aws-events-targets";

export interface OpenSearchWithCloudWatchProps {
    domainName: string;
    username: string;
    password: string;
}

export class OpenSearchCloudWatchHandler extends Construct {
    constructor(scope: Construct, id: string, props: OpenSearchWithCloudWatchProps) {
        super(scope, id);
        const openSearchDomain = this.createOpenSearchDomain(props);
        this.createAnonymousRoleAndPolicy(props);
        this.addAccessPolicyToOpenSearchDomain(openSearchDomain, props);
        const logGroupSubscriptionHandlerLambda = new LogGroupSubscriptionHandlerLambda(this, 'LogGroupSubscriptionHandlerLambda', {
            openSearchDomainArn: openSearchDomain.attrArn
        });
        this.createCloudTrailRule(logGroupSubscriptionHandlerLambda);
        this.addSubscriptionToLogGroups(logGroupSubscriptionHandlerLambda);
        this.enableGatewayCloudWatchLogs();
    }

    private createOpenSearchDomain(props: OpenSearchWithCloudWatchProps) {
        return new opensearch.CfnDomain(this, 'OpenSearchDomain', {
            domainName: props.domainName,
            nodeToNodeEncryptionOptions: { enabled: true },
            encryptionAtRestOptions: { enabled: true },
            advancedSecurityOptions: {
                enabled: true,
                internalUserDatabaseEnabled: true,
                masterUserOptions: {
                    masterUserName: props.username,
                    masterUserPassword: props.password,
                },
            },
            domainEndpointOptions: { enforceHttps: true },
            ebsOptions: { ebsEnabled: true, volumeSize: 10, volumeType: 'gp2' },
            clusterConfig: { instanceType: 't3.small.search', instanceCount: 1 },
        });
    }

    private createAnonymousRoleAndPolicy(props: OpenSearchWithCloudWatchProps) {
        const anonymousRole = new Role(this, 'AnonymousRole', { assumedBy: new AnyPrincipal() });
        anonymousRole.attachInlinePolicy(
            new Policy(this, 'AnonymousPolicy', {
                statements: [
                    new PolicyStatement({
                        effect: Effect.ALLOW,
                        actions: ['es:ESHttp*'],
                        resources: [`arn:aws:es:${Stack.of(this).region}:${Stack.of(this).account}:domain/${props.domainName}/*`],
                    }),
                ],
            })
        );
    }

    private addAccessPolicyToOpenSearchDomain(openSearchDomain: opensearch.CfnDomain, props: OpenSearchWithCloudWatchProps) {
        openSearchDomain.accessPolicies = {
            Version: '2012-10-17',
            Statement: [
                {
                    Effect: 'Allow',
                    Principal: { AWS: '*' },
                    Action: 'es:*',
                    Resource: `arn:aws:es:${Stack.of(this).region}:${Stack.of(this).account}:domain/${props.domainName}/*`,
                },
            ],
        };
    }

    private async addSubscriptionToLogGroups(logGroupSubscriptionHandlerLambda: LogGroupSubscriptionHandlerLambda) {
        const cloudWatchLogs = new AWS.CloudWatchLogs();
        try {
            console.log("**** In addSubscriptionToLogGroups ****** ")
            const { logGroups } = await cloudWatchLogs.describeLogGroups({}).promise();
            if (logGroups) {
                const functionName = Stack.of(logGroupSubscriptionHandlerLambda).resolve(logGroupSubscriptionHandlerLambda.handler.functionName);
                console.log("functionName: ", functionName.Ref);
                await Promise.all(
                    logGroups.map(async (logGroup) => {
                        if (typeof logGroup.logGroupName !== 'string') return;
                        const logGroupName = logGroup.logGroupName;
                        await new Lambda().invoke({
                            FunctionName: logGroupSubscriptionHandlerLambda.handler.functionName,
                            Payload: JSON.stringify({ logGroupName })
                        }).promise();
                    })
                );
            }
        } catch (error) {
            console.error('Error describing log groups:', error);
        }
    }

    private async enableGatewayCloudWatchLogs() {
        try {
            const apiGateway = new APIGateway();
            const { items: apis } = await apiGateway.getRestApis().promise();
            if (apis) {
                await Promise.all(
                    apis.map(async (api) => {
                        const restApiId = api.id;
                        if (restApiId) {
                            const { item: stages } = await apiGateway.getStages({ restApiId }).promise();
                            if (stages) {
                                await Promise.all(
                                    stages.map(async (stage) => {
                                        const stageName = stage.stageName;
                                        if (stageName) {
                                            const params: APIGateway.UpdateStageRequest = {
                                                restApiId: restApiId,
                                                stageName: stageName,
                                                patchOperations: [
                                                    { op: 'replace', path: '/*/*/logging/dataTrace', value: 'true' },
                                                    { op: 'replace', path: '/*/*/logging/loglevel', value: 'INFO' },
                                                    { op: 'replace', path: '/*/*/metrics/enabled', value: 'true' },
                                                ],
                                            };
                                            await apiGateway.updateStage(params).promise();
                                        }
                                    })
                                );
                            }
                        }
                    })
                );
            }
        } catch (error) {
            console.error('Error enabling Gateway CloudWatch logs:', error);
        }
    }

    private createCloudTrailRule(targetFunction: LogGroupSubscriptionHandlerLambda): void {
        const rule = new Rule(this, 'CreateLogGroupRule', {
            eventPattern: {
                source: ['aws.logs'],
                detailType: ['AWS API Call via CloudTrail'],
                detail: {
                    eventName: ['CreateLogGroup'],
                },
            },
        });
        const eventBridgeRole = new Role(this, 'EventBridgeRole', {
            assumedBy: new ServicePrincipal('events.amazonaws.com'),
        });
        targetFunction.handler.grantInvoke(eventBridgeRole);
        return rule.addTarget(new LambdaFunction(targetFunction.handler));
    }
}
