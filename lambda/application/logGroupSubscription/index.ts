import * as AWS from "aws-sdk";

exports.handler = async (event: any) => {
    console.log("******** In LogGroupSubscriptionHandlerLambda **********");
    const cloudWatchLogs = new AWS.CloudWatchLogs();
    const logProcessorLambdaArn = process.env.LOG_PROCESSOR_LAMBDA_ARN;
    console.log("logProcessorLambdaArn: ", logProcessorLambdaArn);
    const addSubscriptionFilter = async (logGroupName: string) => {
        if (!logProcessorLambdaArn) {
            console.error('Log Processor Lambda ARN is not provided');
            return;
        }
        console.log("\nGoing to add subscription for logGroupName: ", logGroupName);
        try {
            const { subscriptionFilters } = await cloudWatchLogs.describeSubscriptionFilters({ logGroupName }).promise();
            if (subscriptionFilters?.length === 0) {
                const putSubscriptionFilterParams = {
                    filterName: `SubscriptionFilter-${logGroupName}`,
                    logGroupName,
                    filterPattern: '',
                    destinationArn: logProcessorLambdaArn
                };
                await cloudWatchLogs.putSubscriptionFilter(putSubscriptionFilterParams).promise();
                console.log(`Subscription filter created for log group "${logGroupName}"`);
            } else {
                console.log(`Log group "${logGroupName}" already has subscriptions. Skipping.`);
            }
        } catch (error) {
            console.error(`Error describing subscription filters for log group "${logGroupName}":`, error);
        }
    };
    const logGroupName = event?.detail?.requestParameters?.logGroupName || event.logGroupName;
    if (logGroupName) {
        await addSubscriptionFilter(logGroupName);
        return;
    }
    if (event.action === 'subscribeAllLogGroups') {
        try {
            const { logGroups } = await cloudWatchLogs.describeLogGroups({}).promise();
            if (logGroups) {
                await Promise.all(logGroups.map(logGroup => {
                    if (typeof logGroup.logGroupName === 'string') {
                        return addSubscriptionFilter(logGroup.logGroupName);
                    }
                }));
            }
        } catch (error) {
            console.error('Error describing log groups:', error);
        }
    }
};
