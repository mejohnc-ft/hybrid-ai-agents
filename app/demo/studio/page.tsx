'use client';

import { useState } from 'react';
import { EntraNexusStudio } from './components/EntraNexusStudio';
import { SettingsPanel } from './components/SettingsPanel';

export default function StudioPage() {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <>
      <EntraNexusStudio onSettingsOpen={() => setSettingsOpen(true)} />
      <SettingsPanel isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
