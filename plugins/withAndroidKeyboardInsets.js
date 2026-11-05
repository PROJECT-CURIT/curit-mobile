const { withMainActivity } = require('expo/config-plugins');

const method = `
  private fun fitContentAboveKeyboard() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return
    val content = findViewById<android.view.View>(android.R.id.content)
    val initialBottom = content.paddingBottom
    val location = IntArray(2)
    val ime = androidx.core.view.WindowInsetsCompat.Type.ime()

    fun applyInsets(insets: androidx.core.view.WindowInsetsCompat) {
      var padding = initialBottom
      if (insets.isVisible(ime) && content.height > 0) {
        content.getLocationOnScreen(location)
        val keyboardTop = windowManager.currentWindowMetrics.bounds.bottom - insets.getInsets(ime).bottom
        val contentBottom = location[1] + content.height
        // Some Android windows already resize. Only account for the part
        // still covered by the IME in an edge-to-edge window. The IME inset
        // already includes the navigation area: subtracting it again leaves
        // the bottom of input fields and send buttons under the keyboard.
        padding += (contentBottom - keyboardTop).coerceAtLeast(0)
      }
      if (padding != content.paddingBottom) {
        content.setPadding(content.paddingLeft, content.paddingTop, content.paddingRight, padding)
      }
    }

    androidx.core.view.ViewCompat.setOnApplyWindowInsetsListener(content) { _, insets ->
      applyInsets(insets)
      insets
    }
    content.addOnLayoutChangeListener { view, _, top, _, bottom, _, oldTop, _, oldBottom ->
      if (top != oldTop || bottom != oldBottom) {
        androidx.core.view.ViewCompat.getRootWindowInsets(view)?.let(::applyInsets)
      }
    }
    androidx.core.view.ViewCompat.requestApplyInsets(content)
  }
`;

module.exports = function withAndroidKeyboardInsets(config) {
  return withMainActivity(config, config => {
    const activity = config.modResults;
    if (activity.contents.includes('private fun fitContentAboveKeyboard()')) return config;
    const anchor = '    super.onCreate(null)\n  }';
    if (activity.language !== 'kt' || !activity.contents.includes(anchor)) {
      throw new Error('Unable to install keyboard inset handling in MainActivity.');
    }
    activity.contents = activity.contents.replace(
      anchor,
      '    super.onCreate(null)\n    fitContentAboveKeyboard()\n  }\n' + method,
    );
    return config;
  });
};
