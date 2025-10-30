import { useState } from "react";
import { logger } from "../lib/logger";

interface Notification {
  id: string;
  type: "info" | "success" | "warning" | "error";
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications] = useState<Notification[]>([
    {
      id: "1",
      type: "success",
      title: "Vault Synchronized",
      message: "Successfully synced 247 entities from Obsidian vault",
      timestamp: new Date(Date.now() - 5 * 60 * 1000),
      read: false,
      action: {
        label: "View Changes",
        onClick: () => logger.info("View changes")
      }
    },
    {
      id: "2",
      type: "warning",
      title: "Workflow Bottleneck Detected",
      message: "Kinetic layer has 15 pending actions that need attention",
      timestamp: new Date(Date.now() - 25 * 60 * 1000),
      read: false,
      action: {
        label: "Review Actions",
        onClick: () => logger.info("Review actions")
      }
    },
    {
      id: "3",
      type: "info",
      title: "New Semantic Entities",
      message: "5 new entities added to knowledge graph from daily notes",
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
      read: true
    },
    {
      id: "4",
      type: "error",
      title: "Connection Failed",
      message: "Unable to connect to n8n workflow automation server",
      timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
      read: false,
      action: {
        label: "Retry Connection",
        onClick: () => logger.info("Retry connection")
      }
    }
  ]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "success": return "✅";
      case "warning": return "⚠️";
      case "error": return "❌";
      default: return "ℹ️";
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case "success": return "border-green-700 bg-green-950/20";
      case "warning": return "border-yellow-700 bg-yellow-950/20";
      case "error": return "border-red-700 bg-red-950/20";
      default: return "border-blue-700 bg-blue-950/20";
    }
  };

  const formatTimestamp = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <>
      {/* Notification Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg transition-all hover:from-blue-500 hover:to-purple-500 hover:scale-110"
        aria-label="Toggle notifications"
      >
        <span className="text-xl">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Panel */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-20 bg-black/20"
            onClick={() => setIsOpen(false)}
            role="button"
            aria-label="Close notifications"
          />

          {/* Panel */}
          <div className="fixed bottom-20 right-6 z-30 w-96 max-h-96 overflow-hidden rounded-xl border border-slate-800 bg-slate-950/95 backdrop-blur-xl shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
              <h3 className="text-sm font-semibold text-slate-200">Notifications</h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button className="text-xs text-blue-400 hover:text-blue-300" aria-label="Mark all notifications as read">
                    Mark all read
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="rounded p-1 text-slate-400 hover:bg-slate-800"
                  aria-label="Close notification panel"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Notifications List */}
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-slate-500">
                  No notifications
                </div>
              ) : (
                <div className="divide-y divide-slate-800">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-4 transition-colors hover:bg-slate-900/50 ${
                        !notification.read ? "bg-slate-900/30" : ""
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-lg">
                          {getNotificationIcon(notification.type)}
                        </span>
                        <div className="flex-1">
                          <div className="flex items-start justify-between">
                            <h4 className="text-sm font-medium text-slate-200">
                              {notification.title}
                            </h4>
                            <span className="text-xs text-slate-500">
                              {formatTimestamp(notification.timestamp)}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-slate-400">
                            {notification.message}
                          </p>
                          {notification.action && (
                            <button
                              onClick={notification.action.onClick}
                              className="mt-2 rounded px-2 py-1 text-xs text-blue-400 hover:bg-blue-950/20"
                            >
                              {notification.action.label}
                            </button>
                          )}
                        </div>
                        {!notification.read && (
                          <div className="h-2 w-2 rounded-full bg-blue-500" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-slate-800 px-4 py-2">
              <button className="w-full rounded-lg border border-slate-700 py-2 text-sm text-slate-400 hover:bg-slate-800 hover:text-slate-200" aria-label="View all notifications">
                View All Notifications
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
