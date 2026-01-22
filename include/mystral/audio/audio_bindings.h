/**
 * Web Audio API JavaScript Bindings
 */

#pragma once

namespace mystral {
namespace js {
class Engine;
}

namespace audio {

/**
 * Initialize Web Audio API bindings (AudioContext, etc.)
 */
void initializeAudioBindings(js::Engine* engine);

}  // namespace audio
}  // namespace mystral
