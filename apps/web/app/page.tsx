"use client";

import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { Workspace } from "../lib/api";

// Placeholder home page. S20 adds creating, renaming and deleting workspaces.
export default function HomePage() {
  const [workspaces, setWorkspaces] = useState<Workspace[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    api
      .listWorkspaces()
      .then(setWorkspaces)
      .catch(() => setFailed(true));
  }, []);

  return (
    <main>
      <h1>Workspaces</h1>
      {failed && <p role="alert">The API is not reachable.</p>}
      {workspaces !== null && workspaces.length === 0 && <p>No workspaces yet.</p>}
      {workspaces !== null && workspaces.length > 0 && (
        <ul>
          {workspaces.map((w) => (
            <li key={w.id}>{w.name}</li>
          ))}
        </ul>
      )}
    </main>
  );
}
