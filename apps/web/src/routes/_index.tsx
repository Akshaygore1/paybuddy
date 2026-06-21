import { Navigate } from "react-router";

import type { Route } from "./+types/_index";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "paybuddy" },
    { name: "description", content: "paybuddy is a web application" },
  ];
}

export default function Home() {
  return <Navigate to="/sign-in" replace />;
}
