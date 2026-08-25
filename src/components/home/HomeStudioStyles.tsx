import { HOME_STUDIO_CSS } from "./home-studio-css";

/** Injected on `/` so home styles always load (dev layout.css can be stale). */
export function HomeStudioStyles() {
  return (
    <style
      id="blocksmith-home-studio"
      dangerouslySetInnerHTML={{ __html: HOME_STUDIO_CSS }}
    />
  );
}
