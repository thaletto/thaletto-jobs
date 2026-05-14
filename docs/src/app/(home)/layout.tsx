import { HomeLayout } from "fumadocs-ui/layouts/home";
import { baseOptions } from "@/lib/layout.shared";
import LightRaysBackground from "@/components/LightRaysBackground";

export default function Layout({ children }: LayoutProps<"/">) {
  return (
    <>
      <LightRaysBackground />
      <HomeLayout {...baseOptions()}>{children}</HomeLayout>
    </>
  );
}
