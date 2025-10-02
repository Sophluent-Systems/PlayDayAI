import { OuterContainer } from "./outercontainer";
import { defaultAppTheme } from "@src/common/theme";
import Title from "./title";

function getBrandingStyles(theme) {
  if (!theme) {
    return {};
  }
  const backgroundColor = theme.colors?.titleBackgroundColor;
  const borderColor = theme.palette?.border;
  return {
    backgroundColor: backgroundColor ?? undefined,
    borderColor: borderColor ?? "rgba(148, 163, 184, 0.35)",
  };
}

export function DefaultLayout(props) {
  const { children, logoBanner, title, theme } = props;
  const themeToUse = theme ?? defaultAppTheme;
  const brandingStyles = getBrandingStyles(themeToUse);

  return (
    <OuterContainer title="Play Day.AI" theme={themeToUse}>
      <div className="flex w-full max-w-5xl flex-col items-center gap-8">
        {logoBanner ? (
          <div className="w-full pt-4">
            <div
              className="glass-panel flex w-full items-center justify-center rounded-3xl border px-12 py-8"
              style={brandingStyles}
            >
              <img
                src="/logo_banner_large.png"
                alt="Play Day.AI logo banner"
                className="h-16 w-auto max-w-full object-contain"
              />
            </div>
          </div>
        ) : null}

        {title ? <Title title={title} theme={themeToUse} /> : null}

        <div className="w-full space-y-6">
          {children}
        </div>
      </div>
    </OuterContainer>
  );
}