# Third-party components

This plugin uses the public plugin, credential and model adapter interfaces of
DeepSeek Harness (DeepSeek AI, MIT) and pi-ai (MIT). They are resolved by the
package manager / host and are not bundled into this plugin archive. Their
original license files remain with those packages.

The browser module uses the host-provided React runtime (MIT). It does not ship
a second React copy. No third-party plugin source is included.

The account API contract was checked against the owner's existing Skivu and
Skymoni source. This plugin has its own lifecycle, credential address, provider
route and UI; it does not include the Skivu desktop application.
