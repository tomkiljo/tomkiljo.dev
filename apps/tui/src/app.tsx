import { useKeyboard } from "@opentui/react";
import { useEffect, useState } from "react";
import { getSystemInfo } from "./lib/system-info";
import { getAgentSystemInfo, isLlmOnline } from "./lib/agent";
import HomeScreen from "./screens/home-screen";
import AskScreen from "./screens/ask-screen";
import JournalScreen from "./screens/journal-screen";

type AppProps = {
  onQuit: () => void;
};

function App({ onQuit }: AppProps) {
  const [systemInfo, setSystemInfo] = useState(() => getSystemInfo());
  const [screen, setScreen] = useState<"home" | "ask" | "journal">("home");
  const [journalInitialSlug, setJournalInitialSlug] = useState<string | undefined>(undefined);
  const [llmOnline, setLlmOnline] = useState(false);
  const [agentSystemInfo, setAgentSystemInfo] =
    useState<Awaited<ReturnType<typeof getAgentSystemInfo>>>(null);

  const openAsk = () => {
    setScreen("ask");
  };

  const openJournal = () => {
    setJournalInitialSlug(undefined);
    setScreen("journal");
  };

  const openCv = () => {
    setJournalInitialSlug("2026-03-05-cv");
    setScreen("journal");
  };

  useKeyboard((key) => {
    const consume = () => {
      key.preventDefault();
      key.stopPropagation();
    };

    if (key.name === "escape" || key.sequence === "\u001b") {
      consume();
      setScreen("home");
      return;
    }

    if (!key.ctrl) {
      return;
    }

    if (key.name === "a") {
      consume();
      openAsk();
      return;
    }

    if (key.name === "d") {
      consume();
      openJournal();
      return;
    }

    if (key.name === "q") {
      consume();
      onQuit();
    }
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setSystemInfo(getSystemInfo());
    }, 60_000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let disposed = false;

    const refreshLlmStatus = async () => {
      const online = await isLlmOnline();
      if (!disposed) {
        setLlmOnline(online);
      }
    };

    void refreshLlmStatus();
    const interval = setInterval(() => {
      void refreshLlmStatus();
    }, 10_000);

    return () => {
      disposed = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let disposed = false;

    const refreshAgentSystemInfo = async () => {
      const info = await getAgentSystemInfo();
      if (!disposed) {
        setAgentSystemInfo(info);
      }
    };

    void refreshAgentSystemInfo();
    const interval = setInterval(() => {
      void refreshAgentSystemInfo();
    }, 10_000);

    return () => {
      disposed = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <box height="100%" flexDirection="column" justifyContent="space-between">
      {screen === "home" ? (
        <HomeScreen
          systemInfo={systemInfo}
          llmOnline={llmOnline}
          agentSystemInfo={agentSystemInfo}
          onOpenAsk={openAsk}
          onOpenJournal={openJournal}
          onOpenCv={openCv}
        />
      ) : screen === "ask" ? (
        <AskScreen />
      ) : (
        <JournalScreen initialSlug={journalInitialSlug} />
      )}
    </box>
  );
}

export default App;
