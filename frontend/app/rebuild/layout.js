import "../globals.css";
import "./rebuild.css";

export const metadata = {
  title: "PR Intelligence Rebuild",
};

export default function RebuildLayout({ children }) {
  return (
    <div className="rb-root">
      <div className="rb-container">{children}</div>
    </div>
  );
}
