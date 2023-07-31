import {Construct} from "constructs";
import {Code, LayerVersion, Runtime} from "aws-cdk-lib/aws-lambda";
import * as path from "path";

export class LogMiddlewareLayerFactory extends Construct {
    static layer: LayerVersion;
    constructor(scope:Construct,id:string) {
        super(scope,id);
        if(!LogMiddlewareLayerFactory.layer) {
            this.createLayer();
        }
    }

    createLayer(): void {
        LogMiddlewareLayerFactory.layer = new LayerVersion(this, "LogMiddlewareLayer", {
            compatibleRuntimes: [Runtime.NODEJS_18_X],
            description: 'Log Middleware Layer',
            code: Code.fromAsset(path.join(__dirname, "layers/logMiddleware/logMiddleware.ts")),
            layerVersionName: `log-middleware-layer`
        });
    }

    getLayer(): LayerVersion {
        if (!LogMiddlewareLayerFactory.layer) {
            this.createLayer();
        }
        return LogMiddlewareLayerFactory.layer;
    }
}