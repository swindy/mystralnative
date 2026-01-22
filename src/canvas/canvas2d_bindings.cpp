/**
 * Canvas 2D JavaScript Bindings
 *
 * Creates JavaScript objects that wrap native Canvas2DContext.
 * This exposes the CanvasRenderingContext2D API to JavaScript.
 */

#include "mystral/canvas/canvas2d.h"
#include "mystral/js/engine.h"
#include <iostream>
#include <unordered_map>

namespace mystral {
namespace canvas {

// Global storage for Canvas2D contexts (prevents them from being destroyed)
static std::unordered_map<void*, std::unique_ptr<Canvas2DContext>> g_canvas2dContexts;

// Store reference to JS engine for callbacks
static js::Engine* g_jsEngine = nullptr;

/**
 * Create a CanvasRenderingContext2D JS object that wraps a native Canvas2DContext
 */
js::JSValueHandle createCanvas2DJSObject(js::Engine* engine, Canvas2DContext* ctx) {
    g_jsEngine = engine;

    auto jsCtx = engine->newObject();

    // Store the native context pointer
    engine->setPrivateData(jsCtx, ctx);

    // Mark the type
    engine->setProperty(jsCtx, "_contextType", engine->newString("2d"));

    // ========================================================================
    // Properties (as getter functions for now)
    // ========================================================================

    // canvas property (will be set by caller)
    engine->setProperty(jsCtx, "canvas", engine->newNull());

    // fillStyle
    engine->setProperty(jsCtx, "fillStyle", engine->newString("#000000"));
    engine->setProperty(jsCtx, "_setFillStyle",
        engine->newFunction("_setFillStyle", [](void* c, const std::vector<js::JSValueHandle>& args) {
            if (args.empty()) return g_jsEngine->newUndefined();
            auto ctx = static_cast<Canvas2DContext*>(g_jsEngine->getPrivateData(args[0]));
            if (ctx && args.size() > 1) {
                ctx->setFillStyle(g_jsEngine->toString(args[1]));
            }
            return g_jsEngine->newUndefined();
        })
    );

    // strokeStyle
    engine->setProperty(jsCtx, "strokeStyle", engine->newString("#000000"));
    engine->setProperty(jsCtx, "_setStrokeStyle",
        engine->newFunction("_setStrokeStyle", [](void* c, const std::vector<js::JSValueHandle>& args) {
            if (args.empty()) return g_jsEngine->newUndefined();
            auto ctx = static_cast<Canvas2DContext*>(g_jsEngine->getPrivateData(args[0]));
            if (ctx && args.size() > 1) {
                ctx->setStrokeStyle(g_jsEngine->toString(args[1]));
            }
            return g_jsEngine->newUndefined();
        })
    );

    // lineWidth
    engine->setProperty(jsCtx, "lineWidth", engine->newNumber(1.0));
    engine->setProperty(jsCtx, "_setLineWidth",
        engine->newFunction("_setLineWidth", [](void* c, const std::vector<js::JSValueHandle>& args) {
            if (args.empty()) return g_jsEngine->newUndefined();
            auto ctx = static_cast<Canvas2DContext*>(g_jsEngine->getPrivateData(args[0]));
            if (ctx && args.size() > 1) {
                ctx->setLineWidth(static_cast<float>(g_jsEngine->toNumber(args[1])));
            }
            return g_jsEngine->newUndefined();
        })
    );

    // globalAlpha
    engine->setProperty(jsCtx, "globalAlpha", engine->newNumber(1.0));
    engine->setProperty(jsCtx, "_setGlobalAlpha",
        engine->newFunction("_setGlobalAlpha", [](void* c, const std::vector<js::JSValueHandle>& args) {
            if (args.empty()) return g_jsEngine->newUndefined();
            auto ctx = static_cast<Canvas2DContext*>(g_jsEngine->getPrivateData(args[0]));
            if (ctx && args.size() > 1) {
                ctx->setGlobalAlpha(static_cast<float>(g_jsEngine->toNumber(args[1])));
            }
            return g_jsEngine->newUndefined();
        })
    );

    // font
    engine->setProperty(jsCtx, "font", engine->newString("10px sans-serif"));
    engine->setProperty(jsCtx, "_setFont",
        engine->newFunction("_setFont", [](void* c, const std::vector<js::JSValueHandle>& args) {
            if (args.empty()) return g_jsEngine->newUndefined();
            auto ctx = static_cast<Canvas2DContext*>(g_jsEngine->getPrivateData(args[0]));
            if (ctx && args.size() > 1) {
                ctx->setFont(g_jsEngine->toString(args[1]));
            }
            return g_jsEngine->newUndefined();
        })
    );

    // textAlign
    engine->setProperty(jsCtx, "textAlign", engine->newString("start"));
    engine->setProperty(jsCtx, "_setTextAlign",
        engine->newFunction("_setTextAlign", [](void* c, const std::vector<js::JSValueHandle>& args) {
            if (args.empty()) return g_jsEngine->newUndefined();
            auto ctx = static_cast<Canvas2DContext*>(g_jsEngine->getPrivateData(args[0]));
            if (ctx && args.size() > 1) {
                ctx->setTextAlign(g_jsEngine->toString(args[1]));
            }
            return g_jsEngine->newUndefined();
        })
    );

    // textBaseline
    engine->setProperty(jsCtx, "textBaseline", engine->newString("alphabetic"));
    engine->setProperty(jsCtx, "_setTextBaseline",
        engine->newFunction("_setTextBaseline", [](void* c, const std::vector<js::JSValueHandle>& args) {
            if (args.empty()) return g_jsEngine->newUndefined();
            auto ctx = static_cast<Canvas2DContext*>(g_jsEngine->getPrivateData(args[0]));
            if (ctx && args.size() > 1) {
                ctx->setTextBaseline(g_jsEngine->toString(args[1]));
            }
            return g_jsEngine->newUndefined();
        })
    );

    // ========================================================================
    // Methods
    // ========================================================================

    // save()
    engine->setProperty(jsCtx, "save",
        engine->newFunction("save", [](void* c, const std::vector<js::JSValueHandle>& args) {
            auto self = g_jsEngine->getGlobalProperty("__canvas2dContext");
            auto ctx = static_cast<Canvas2DContext*>(g_jsEngine->getPrivateData(self));
            if (ctx) ctx->save();
            return g_jsEngine->newUndefined();
        })
    );

    // restore()
    engine->setProperty(jsCtx, "restore",
        engine->newFunction("restore", [](void* c, const std::vector<js::JSValueHandle>& args) {
            auto self = g_jsEngine->getGlobalProperty("__canvas2dContext");
            auto ctx = static_cast<Canvas2DContext*>(g_jsEngine->getPrivateData(self));
            if (ctx) ctx->restore();
            return g_jsEngine->newUndefined();
        })
    );

    // fillText(text, x, y)
    engine->setProperty(jsCtx, "fillText",
        engine->newFunction("fillText", [](void* c, const std::vector<js::JSValueHandle>& args) {
            auto self = g_jsEngine->getGlobalProperty("__canvas2dContext");
            auto ctx = static_cast<Canvas2DContext*>(g_jsEngine->getPrivateData(self));
            if (ctx && args.size() >= 3) {
                std::string text = g_jsEngine->toString(args[0]);
                float x = static_cast<float>(g_jsEngine->toNumber(args[1]));
                float y = static_cast<float>(g_jsEngine->toNumber(args[2]));
                ctx->fillText(text, x, y);
            }
            return g_jsEngine->newUndefined();
        })
    );

    // measureText(text) -> { width }
    engine->setProperty(jsCtx, "measureText",
        engine->newFunction("measureText", [](void* c, const std::vector<js::JSValueHandle>& args) {
            auto self = g_jsEngine->getGlobalProperty("__canvas2dContext");
            auto ctx = static_cast<Canvas2DContext*>(g_jsEngine->getPrivateData(self));

            auto result = g_jsEngine->newObject();
            if (ctx && !args.empty()) {
                std::string text = g_jsEngine->toString(args[0]);
                TextMetrics metrics = ctx->measureText(text);

                g_jsEngine->setProperty(result, "width", g_jsEngine->newNumber(metrics.width));
                g_jsEngine->setProperty(result, "actualBoundingBoxLeft", g_jsEngine->newNumber(metrics.actualBoundingBoxLeft));
                g_jsEngine->setProperty(result, "actualBoundingBoxRight", g_jsEngine->newNumber(metrics.actualBoundingBoxRight));
                g_jsEngine->setProperty(result, "actualBoundingBoxAscent", g_jsEngine->newNumber(metrics.actualBoundingBoxAscent));
                g_jsEngine->setProperty(result, "actualBoundingBoxDescent", g_jsEngine->newNumber(metrics.actualBoundingBoxDescent));
                g_jsEngine->setProperty(result, "fontBoundingBoxAscent", g_jsEngine->newNumber(metrics.fontBoundingBoxAscent));
                g_jsEngine->setProperty(result, "fontBoundingBoxDescent", g_jsEngine->newNumber(metrics.fontBoundingBoxDescent));
            } else {
                g_jsEngine->setProperty(result, "width", g_jsEngine->newNumber(0));
            }
            return result;
        })
    );

    // fillRect(x, y, width, height)
    engine->setProperty(jsCtx, "fillRect",
        engine->newFunction("fillRect", [](void* c, const std::vector<js::JSValueHandle>& args) {
            auto self = g_jsEngine->getGlobalProperty("__canvas2dContext");
            auto ctx = static_cast<Canvas2DContext*>(g_jsEngine->getPrivateData(self));
            if (ctx && args.size() >= 4) {
                ctx->fillRect(
                    static_cast<float>(g_jsEngine->toNumber(args[0])),
                    static_cast<float>(g_jsEngine->toNumber(args[1])),
                    static_cast<float>(g_jsEngine->toNumber(args[2])),
                    static_cast<float>(g_jsEngine->toNumber(args[3]))
                );
            }
            return g_jsEngine->newUndefined();
        })
    );

    // strokeRect(x, y, width, height)
    engine->setProperty(jsCtx, "strokeRect",
        engine->newFunction("strokeRect", [](void* c, const std::vector<js::JSValueHandle>& args) {
            auto self = g_jsEngine->getGlobalProperty("__canvas2dContext");
            auto ctx = static_cast<Canvas2DContext*>(g_jsEngine->getPrivateData(self));
            if (ctx && args.size() >= 4) {
                ctx->strokeRect(
                    static_cast<float>(g_jsEngine->toNumber(args[0])),
                    static_cast<float>(g_jsEngine->toNumber(args[1])),
                    static_cast<float>(g_jsEngine->toNumber(args[2])),
                    static_cast<float>(g_jsEngine->toNumber(args[3]))
                );
            }
            return g_jsEngine->newUndefined();
        })
    );

    // clearRect(x, y, width, height)
    engine->setProperty(jsCtx, "clearRect",
        engine->newFunction("clearRect", [](void* c, const std::vector<js::JSValueHandle>& args) {
            auto self = g_jsEngine->getGlobalProperty("__canvas2dContext");
            auto ctx = static_cast<Canvas2DContext*>(g_jsEngine->getPrivateData(self));
            if (ctx && args.size() >= 4) {
                ctx->clearRect(
                    static_cast<float>(g_jsEngine->toNumber(args[0])),
                    static_cast<float>(g_jsEngine->toNumber(args[1])),
                    static_cast<float>(g_jsEngine->toNumber(args[2])),
                    static_cast<float>(g_jsEngine->toNumber(args[3]))
                );
            }
            return g_jsEngine->newUndefined();
        })
    );

    // beginPath()
    engine->setProperty(jsCtx, "beginPath",
        engine->newFunction("beginPath", [](void* c, const std::vector<js::JSValueHandle>& args) {
            auto self = g_jsEngine->getGlobalProperty("__canvas2dContext");
            auto ctx = static_cast<Canvas2DContext*>(g_jsEngine->getPrivateData(self));
            if (ctx) ctx->beginPath();
            return g_jsEngine->newUndefined();
        })
    );

    // closePath()
    engine->setProperty(jsCtx, "closePath",
        engine->newFunction("closePath", [](void* c, const std::vector<js::JSValueHandle>& args) {
            auto self = g_jsEngine->getGlobalProperty("__canvas2dContext");
            auto ctx = static_cast<Canvas2DContext*>(g_jsEngine->getPrivateData(self));
            if (ctx) ctx->closePath();
            return g_jsEngine->newUndefined();
        })
    );

    // moveTo(x, y)
    engine->setProperty(jsCtx, "moveTo",
        engine->newFunction("moveTo", [](void* c, const std::vector<js::JSValueHandle>& args) {
            auto self = g_jsEngine->getGlobalProperty("__canvas2dContext");
            auto ctx = static_cast<Canvas2DContext*>(g_jsEngine->getPrivateData(self));
            if (ctx && args.size() >= 2) {
                ctx->moveTo(
                    static_cast<float>(g_jsEngine->toNumber(args[0])),
                    static_cast<float>(g_jsEngine->toNumber(args[1]))
                );
            }
            return g_jsEngine->newUndefined();
        })
    );

    // lineTo(x, y)
    engine->setProperty(jsCtx, "lineTo",
        engine->newFunction("lineTo", [](void* c, const std::vector<js::JSValueHandle>& args) {
            auto self = g_jsEngine->getGlobalProperty("__canvas2dContext");
            auto ctx = static_cast<Canvas2DContext*>(g_jsEngine->getPrivateData(self));
            if (ctx && args.size() >= 2) {
                ctx->lineTo(
                    static_cast<float>(g_jsEngine->toNumber(args[0])),
                    static_cast<float>(g_jsEngine->toNumber(args[1]))
                );
            }
            return g_jsEngine->newUndefined();
        })
    );

    // quadraticCurveTo(cpx, cpy, x, y)
    engine->setProperty(jsCtx, "quadraticCurveTo",
        engine->newFunction("quadraticCurveTo", [](void* c, const std::vector<js::JSValueHandle>& args) {
            auto self = g_jsEngine->getGlobalProperty("__canvas2dContext");
            auto ctx = static_cast<Canvas2DContext*>(g_jsEngine->getPrivateData(self));
            if (ctx && args.size() >= 4) {
                ctx->quadraticCurveTo(
                    static_cast<float>(g_jsEngine->toNumber(args[0])),
                    static_cast<float>(g_jsEngine->toNumber(args[1])),
                    static_cast<float>(g_jsEngine->toNumber(args[2])),
                    static_cast<float>(g_jsEngine->toNumber(args[3]))
                );
            }
            return g_jsEngine->newUndefined();
        })
    );

    // bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y)
    engine->setProperty(jsCtx, "bezierCurveTo",
        engine->newFunction("bezierCurveTo", [](void* c, const std::vector<js::JSValueHandle>& args) {
            auto self = g_jsEngine->getGlobalProperty("__canvas2dContext");
            auto ctx = static_cast<Canvas2DContext*>(g_jsEngine->getPrivateData(self));
            if (ctx && args.size() >= 6) {
                ctx->bezierCurveTo(
                    static_cast<float>(g_jsEngine->toNumber(args[0])),
                    static_cast<float>(g_jsEngine->toNumber(args[1])),
                    static_cast<float>(g_jsEngine->toNumber(args[2])),
                    static_cast<float>(g_jsEngine->toNumber(args[3])),
                    static_cast<float>(g_jsEngine->toNumber(args[4])),
                    static_cast<float>(g_jsEngine->toNumber(args[5]))
                );
            }
            return g_jsEngine->newUndefined();
        })
    );

    // arc(x, y, radius, startAngle, endAngle, counterclockwise)
    engine->setProperty(jsCtx, "arc",
        engine->newFunction("arc", [](void* c, const std::vector<js::JSValueHandle>& args) {
            auto self = g_jsEngine->getGlobalProperty("__canvas2dContext");
            auto ctx = static_cast<Canvas2DContext*>(g_jsEngine->getPrivateData(self));
            if (ctx && args.size() >= 5) {
                bool ccw = args.size() > 5 ? g_jsEngine->toBoolean(args[5]) : false;
                ctx->arc(
                    static_cast<float>(g_jsEngine->toNumber(args[0])),
                    static_cast<float>(g_jsEngine->toNumber(args[1])),
                    static_cast<float>(g_jsEngine->toNumber(args[2])),
                    static_cast<float>(g_jsEngine->toNumber(args[3])),
                    static_cast<float>(g_jsEngine->toNumber(args[4])),
                    ccw
                );
            }
            return g_jsEngine->newUndefined();
        })
    );

    // fill()
    engine->setProperty(jsCtx, "fill",
        engine->newFunction("fill", [](void* c, const std::vector<js::JSValueHandle>& args) {
            auto self = g_jsEngine->getGlobalProperty("__canvas2dContext");
            auto ctx = static_cast<Canvas2DContext*>(g_jsEngine->getPrivateData(self));
            if (ctx) ctx->fill();
            return g_jsEngine->newUndefined();
        })
    );

    // stroke()
    engine->setProperty(jsCtx, "stroke",
        engine->newFunction("stroke", [](void* c, const std::vector<js::JSValueHandle>& args) {
            auto self = g_jsEngine->getGlobalProperty("__canvas2dContext");
            auto ctx = static_cast<Canvas2DContext*>(g_jsEngine->getPrivateData(self));
            if (ctx) ctx->stroke();
            return g_jsEngine->newUndefined();
        })
    );

    // getImageData(x, y, width, height) -> ImageData
    engine->setProperty(jsCtx, "getImageData",
        engine->newFunction("getImageData", [](void* c, const std::vector<js::JSValueHandle>& args) {
            auto self = g_jsEngine->getGlobalProperty("__canvas2dContext");
            auto ctx = static_cast<Canvas2DContext*>(g_jsEngine->getPrivateData(self));

            auto result = g_jsEngine->newObject();
            if (ctx && args.size() >= 4) {
                int x = static_cast<int>(g_jsEngine->toNumber(args[0]));
                int y = static_cast<int>(g_jsEngine->toNumber(args[1]));
                int w = static_cast<int>(g_jsEngine->toNumber(args[2]));
                int h = static_cast<int>(g_jsEngine->toNumber(args[3]));

                ImageData imgData = ctx->getImageData(x, y, w, h);

                g_jsEngine->setProperty(result, "width", g_jsEngine->newNumber(imgData.width));
                g_jsEngine->setProperty(result, "height", g_jsEngine->newNumber(imgData.height));

                // Create Uint8Array for data (ImageData.data is Uint8ClampedArray in browsers)
                // Using Uint8Array allows direct indexing with []
                auto dataArray = g_jsEngine->createUint8Array(imgData.data.data(), imgData.data.size());
                g_jsEngine->setProperty(result, "data", dataArray);
            }
            return result;
        })
    );

    std::cout << "[Canvas2D] JS bindings created" << std::endl;
    return jsCtx;
}

/**
 * Create a new Canvas2D context for a canvas element
 *
 * @param engine The JS engine
 * @param width Canvas width
 * @param height Canvas height
 * @return JS object representing the CanvasRenderingContext2D
 */
js::JSValueHandle createCanvas2DContext(js::Engine* engine, int width, int height) {
    // Create native context
    auto nativeCtx = std::make_unique<Canvas2DContext>(width, height);
    Canvas2DContext* ctxPtr = nativeCtx.get();

    // Create JS bindings
    auto jsCtx = createCanvas2DJSObject(engine, ctxPtr);

    // Store the native context to prevent deletion
    g_canvas2dContexts[ctxPtr] = std::move(nativeCtx);

    // Store globally for method callbacks
    engine->setGlobalProperty("__canvas2dContext", jsCtx);
    engine->protect(jsCtx);

    // Set up property interceptors for fillStyle, strokeStyle, etc.
    // These call the native setters when properties are changed
    const char* setupPropertyInterceptors = R"(
        (function(ctx) {
            var _fillStyle = '#000000';
            var _strokeStyle = '#000000';
            var _lineWidth = 1.0;
            var _globalAlpha = 1.0;
            var _font = '10px sans-serif';
            var _textAlign = 'start';
            var _textBaseline = 'alphabetic';

            Object.defineProperty(ctx, 'fillStyle', {
                get: function() { return _fillStyle; },
                set: function(v) {
                    _fillStyle = v;
                    ctx.__nativeSetFillStyle(v);
                }
            });

            Object.defineProperty(ctx, 'strokeStyle', {
                get: function() { return _strokeStyle; },
                set: function(v) {
                    _strokeStyle = v;
                    ctx.__nativeSetStrokeStyle(v);
                }
            });

            Object.defineProperty(ctx, 'lineWidth', {
                get: function() { return _lineWidth; },
                set: function(v) {
                    _lineWidth = v;
                    ctx.__nativeSetLineWidth(v);
                }
            });

            Object.defineProperty(ctx, 'globalAlpha', {
                get: function() { return _globalAlpha; },
                set: function(v) {
                    _globalAlpha = v;
                    ctx.__nativeSetGlobalAlpha(v);
                }
            });

            Object.defineProperty(ctx, 'font', {
                get: function() { return _font; },
                set: function(v) {
                    _font = v;
                    ctx.__nativeSetFont(v);
                }
            });

            Object.defineProperty(ctx, 'textAlign', {
                get: function() { return _textAlign; },
                set: function(v) {
                    _textAlign = v;
                    ctx.__nativeSetTextAlign(v);
                }
            });

            Object.defineProperty(ctx, 'textBaseline', {
                get: function() { return _textBaseline; },
                set: function(v) {
                    _textBaseline = v;
                    ctx.__nativeSetTextBaseline(v);
                }
            });
        })(__canvas2dContext);
    )";

    // Add native setter methods to the context
    engine->setProperty(jsCtx, "__nativeSetFillStyle",
        engine->newFunction("__nativeSetFillStyle", [](void* c, const std::vector<js::JSValueHandle>& args) {
            auto ctx = static_cast<Canvas2DContext*>(g_jsEngine->getPrivateData(
                g_jsEngine->getGlobalProperty("__canvas2dContext")));
            if (ctx && !args.empty()) {
                ctx->setFillStyle(g_jsEngine->toString(args[0]));
            }
            return g_jsEngine->newUndefined();
        })
    );

    engine->setProperty(jsCtx, "__nativeSetStrokeStyle",
        engine->newFunction("__nativeSetStrokeStyle", [](void* c, const std::vector<js::JSValueHandle>& args) {
            auto ctx = static_cast<Canvas2DContext*>(g_jsEngine->getPrivateData(
                g_jsEngine->getGlobalProperty("__canvas2dContext")));
            if (ctx && !args.empty()) {
                ctx->setStrokeStyle(g_jsEngine->toString(args[0]));
            }
            return g_jsEngine->newUndefined();
        })
    );

    engine->setProperty(jsCtx, "__nativeSetLineWidth",
        engine->newFunction("__nativeSetLineWidth", [](void* c, const std::vector<js::JSValueHandle>& args) {
            auto ctx = static_cast<Canvas2DContext*>(g_jsEngine->getPrivateData(
                g_jsEngine->getGlobalProperty("__canvas2dContext")));
            if (ctx && !args.empty()) {
                ctx->setLineWidth(static_cast<float>(g_jsEngine->toNumber(args[0])));
            }
            return g_jsEngine->newUndefined();
        })
    );

    engine->setProperty(jsCtx, "__nativeSetGlobalAlpha",
        engine->newFunction("__nativeSetGlobalAlpha", [](void* c, const std::vector<js::JSValueHandle>& args) {
            auto ctx = static_cast<Canvas2DContext*>(g_jsEngine->getPrivateData(
                g_jsEngine->getGlobalProperty("__canvas2dContext")));
            if (ctx && !args.empty()) {
                ctx->setGlobalAlpha(static_cast<float>(g_jsEngine->toNumber(args[0])));
            }
            return g_jsEngine->newUndefined();
        })
    );

    engine->setProperty(jsCtx, "__nativeSetFont",
        engine->newFunction("__nativeSetFont", [](void* c, const std::vector<js::JSValueHandle>& args) {
            auto ctx = static_cast<Canvas2DContext*>(g_jsEngine->getPrivateData(
                g_jsEngine->getGlobalProperty("__canvas2dContext")));
            if (ctx && !args.empty()) {
                ctx->setFont(g_jsEngine->toString(args[0]));
            }
            return g_jsEngine->newUndefined();
        })
    );

    engine->setProperty(jsCtx, "__nativeSetTextAlign",
        engine->newFunction("__nativeSetTextAlign", [](void* c, const std::vector<js::JSValueHandle>& args) {
            auto ctx = static_cast<Canvas2DContext*>(g_jsEngine->getPrivateData(
                g_jsEngine->getGlobalProperty("__canvas2dContext")));
            if (ctx && !args.empty()) {
                ctx->setTextAlign(g_jsEngine->toString(args[0]));
            }
            return g_jsEngine->newUndefined();
        })
    );

    engine->setProperty(jsCtx, "__nativeSetTextBaseline",
        engine->newFunction("__nativeSetTextBaseline", [](void* c, const std::vector<js::JSValueHandle>& args) {
            auto ctx = static_cast<Canvas2DContext*>(g_jsEngine->getPrivateData(
                g_jsEngine->getGlobalProperty("__canvas2dContext")));
            if (ctx && !args.empty()) {
                ctx->setTextBaseline(g_jsEngine->toString(args[0]));
            }
            return g_jsEngine->newUndefined();
        })
    );

    // Execute the property interceptor setup
    engine->eval(setupPropertyInterceptors, "canvas2d-setup");

    return jsCtx;
}

/**
 * Get the native Canvas2DContext from a JS context object
 */
Canvas2DContext* getCanvas2DContextFromJS(js::Engine* engine, js::JSValueHandle jsCtx) {
    return static_cast<Canvas2DContext*>(engine->getPrivateData(jsCtx));
}

}  // namespace canvas
}  // namespace mystral
