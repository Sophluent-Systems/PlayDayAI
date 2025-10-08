"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { MessagesContainer } from "@src/client/components/messagescontainer";
import { FilteredMessageList } from "@src/client/components/filteredmessagelist";
import { callSubmitMessageRating } from "@src/client/responseratings";
import { findMessageIndexByRecordID } from "@src/common/messages";
import { callGetRecordResultField, callGetMessageHistorySnapshot, callCloneSession } from "@src/client/editor";
import { defaultAppTheme } from "@src/common/theme";
import TextPreviewModal from "./standard/textpreviewmodal";
import { stateManager } from "@src/client/statemanager";
import { useConfig } from "@src/client/configprovider";
import { Copy } from "lucide-react";

export function SessionViewer({ theme, sessionID, game, editMode }) {
  const { Constants } = useConfig();
  const router = useRouter();
  const { switchSessionID, navigateTo, session } = React.useContext(stateManager);

  const [messages, setMessages] = useState([]);
  const [isDocPreviewOpen, setIsDocPreviewOpen] = useState(false);
  const [docPreviewText, setDocPreviewText] = useState("");
  const [messageFilter, setMessageFilter] = useState(Constants.defaultMessageFilter);

  const bottomRef = useRef(null);

  useEffect(() => {
    if (!sessionID || !game?.gameID) {
      return;
    }

    const requestHistory = async () => {
      try {
        const history = await callGetMessageHistorySnapshot(game.gameID, sessionID);
        setMessages(history?.messages ?? []);
      } catch (error) {
        console.error("Error fetching session history", error);
        router.replace("/");
      }
    };

    requestHistory();
  }, [game?.gameID, sessionID, router]);

  useEffect(() => {
    const timer = setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 120);
    return () => clearTimeout(timer);
  }, [messages]);

  const handleCardActionSelected = async (action, params) => {
    if (action === "responseFeedback") {
      const { message, isPlayerRating, rating } = params;
      try {
        const result = await callSubmitMessageRating(
          sessionID,
          message.recordID,
          isPlayerRating ? rating : undefined,
          !isPlayerRating ? rating : undefined,
        );
        
        // Update the message in local state since SessionViewer doesn't use websockets
        const messageIndex = findMessageIndexByRecordID(messages, message.recordID);
        if (messageIndex >= 0) {
          setMessages((currentMessages) => {
            const updatedMessages = [...currentMessages];
            const updatedMessage = { ...updatedMessages[messageIndex] };
            
            // Update the ratings field
            updatedMessage.ratings = {
              ...updatedMessage.ratings,
              ...(isPlayerRating ? { playerRating: rating } : { adminRating: rating })
            };
            
            updatedMessages[messageIndex] = updatedMessage;
            console.log('[SessionViewer DEBUG] Updated message ratings:', JSON.stringify(updatedMessage.ratings));
            return updatedMessages;
          });
        }
      } catch (error) {
        console.error("Failed to update rating", error);
      }
      return;
    }

    if (action === "showRecordResultFields") {
      const { recordID, fields, label } = params;
      const prompt = await callGetRecordResultField(sessionID, recordID, fields);
      if (prompt) {
        const screenReadyText = prompt.replace(/\\n/gi, "\n");
        setDocPreviewText(`${label}\n\n${screenReadyText}`);
        setIsDocPreviewOpen(true);
      }
    }
  };

  const handleCopyToDebug = async () => {
    try {
      const response = await callCloneSession(game.gameID, sessionID);
      const newSessionID = response.sessionID;
      await switchSessionID(newSessionID);
      navigateTo("/play", game.url);
    } catch (error) {
      console.error("Failed to copy session", error);
    }
  };

  const footerLabel = messages?.length ? `${messages.length} messages` : "";

  return (
    <div className="flex h-full w-full flex-col gap-4">
      <MessagesContainer
        theme={{ ...defaultAppTheme, ...game?.theme, ...theme }}
        title={game?.title}
        footer={footerLabel}
        editMode
      >
        <FilteredMessageList
          theme={theme}
          messages={messages}
          responseFeedbackMode={{ user: "readonly", admin: "edit" }}
          editMode={editMode}
          onCardActionSelected={handleCardActionSelected}
          messageFilter={messageFilter ?? Constants.defaultMessageFilter}
        />
        <div ref={bottomRef} />
      </MessagesContainer>

      <div className="flex justify-center">
        <button
          type="button"
          onClick={handleCopyToDebug}
          className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-surface px-5 py-2 text-sm font-medium text-emphasis transition hover:border-primary/50 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        >
          <Copy className="h-4 w-4" aria-hidden="true" />
          Copy to debug
        </button>
      </div>

      <TextPreviewModal
        isOpen={isDocPreviewOpen}
        text={docPreviewText}
        onClose={() => setIsDocPreviewOpen(false)}
      />
    </div>
  );
}

export default SessionViewer;
