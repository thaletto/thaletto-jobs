import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { appName, gitConfig } from "./shared";

const NpmIcon = () => (
  <svg
    viewBox="0 0 2500 2500"
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
  >
    <path fill="#c00" d="M0 0h2500v2500H0z" />
    <path
      fill="#fff"
      d="M1241.5 268.5h-973v1962.9h972.9V763.5h495v1467.9h495V268.5z"
    />
  </svg>
);

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: appName,
    },
    githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
    links: [
      {
        type: "icon",
        label: "npm",
        icon: <NpmIcon />,
        text: "npm",
        url: `https://www.npmjs.com/package/@${gitConfig.user}/${gitConfig.repo}`,
      },
    ],
  };
}
