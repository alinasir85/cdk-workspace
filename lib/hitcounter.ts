import {Code, Function, IFunction, Runtime} from "aws-cdk-lib/aws-lambda";
import {Construct} from "constructs";

export interface HitCounterProps {
    downstream: IFunction;
}
export class HitCounter extends Construct {
    public readonly handler: Function;
    constructor(scope: Construct, id: string, props: HitCounterProps) {
        super(scope,id);
        this.handler = new Function(this,'HitCounterHandler',{
            runtime: Runtime.NODEJS_18_X,
            handler: 'hitcounter.handler',
            code: Code.fromAsset('lambda'),
            environment: {
                DOWNSTREAM_FUNCTION_NAME: props.downstream.functionName
            }
        });
        props.downstream.grantInvoke(this.handler);
    }
}