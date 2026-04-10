import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { useAuthStore } from "../../store/authStore";
import { useChatStore } from "../../store/chatStore";
import type { GroupMember, GroupRole } from "../../store/chatTypes";
import { useSocketStore } from "../../store/socketStore";
import MessageInput from "../chat/MessageInput";
import MessageList from "../chat/MessageList";

export default function ChatWindow() {
  const user = useAuthStore((state) => state.user);
  const groups = useChatStore((state) => state.groups);
  const activeGroupId = useChatStore((state) => state.activeGroupId);
  const activeGroupDetails = useChatStore((state) => state.activeGroupDetails);
  const loadGroupDetails = useChatStore((state) => state.loadGroupDetails);
  const loadGroupMembers = useChatStore((state) => state.loadGroupMembers);
  const leaveGroup = useChatStore((state) => state.leaveGroup);
  const updateGroup = useChatStore((state) => state.updateGroup);
  const deleteGroup = useChatStore((state) => state.deleteGroup);
  const updateMemberRole = useChatStore((state) => state.updateMemberRole);
  const kickMember = useChatStore((state) => state.kickMember);
  const isLoadingGroupDetails = useChatStore(
    (state) => state.isLoadingGroupDetails,
  );
  const groupError = useChatStore((state) => state.error);
  const activeGroup = useMemo(
    () =>
      activeGroupDetails?._id === activeGroupId
        ? activeGroupDetails
        : groups.find((group) => group._id === activeGroupId) ?? null,
    [activeGroupDetails, activeGroupId, groups],
  );
  const isConnected = useSocketStore((state) => state.isConnected);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [avatar, setAvatar] = useState("");
  const [tags, setTags] = useState("");
  const [maxMembers, setMaxMembers] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [memberActionId, setMemberActionId] = useState<string | null>(null);

  useEffect(() => {
    if (!activeGroupId) {
      return;
    }

    void loadGroupDetails(activeGroupId);
    void loadGroupMembers(activeGroupId);
  }, [activeGroupId, loadGroupDetails, loadGroupMembers]);

  useEffect(() => {
    setName(activeGroup?.name ?? "");
    setDescription(activeGroup?.description ?? "");
    setAvatar(activeGroup?.avatar ?? "");
    setTags(activeGroup?.tags?.join(", ") ?? "");
    setMaxMembers(
      activeGroup?.maxMembers ? String(activeGroup.maxMembers) : "",
    );
  }, [activeGroup]);

  const currentMember = activeGroup?.members?.find(
    (member) => member.user._id === user?._id,
  );
  const currentRole = currentMember?.role;
  const canAdmin = currentRole === "owner" || currentRole === "admin";
  const canModerate =
    currentRole === "owner" ||
    currentRole === "admin" ||
    currentRole === "moderator";

  const handleSaveGroup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!activeGroupId) {
      return;
    }

    setIsSaving(true);

    try {
      await updateGroup(activeGroupId, {
        name: name.trim() || undefined,
        description: description.trim() || undefined,
        avatar: avatar.trim() || undefined,
        maxMembers: maxMembers.trim() ? Number(maxMembers) : undefined,
        tags: tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      });
      await loadGroupDetails(activeGroupId);
      await loadGroupMembers(activeGroupId);
    } finally {
      setIsSaving(false);
    }
  };

  const handleLeaveGroup = async () => {
    if (!activeGroupId) {
      return;
    }

    if (!window.confirm(`Leave ${activeGroup?.name ?? "this group"}?`)) {
      return;
    }

    setIsLeaving(true);
    try {
      await leaveGroup(activeGroupId);
    } finally {
      setIsLeaving(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!activeGroupId) {
      return;
    }

    if (
      !window.confirm(
        `Delete ${activeGroup?.name ?? "this group"}? This cannot be undone.`,
      )
    ) {
      return;
    }

    setIsDeleting(true);
    try {
      await deleteGroup(activeGroupId);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRoleChange = async (member: GroupMember, role: GroupRole) => {
    if (!activeGroupId) {
      return;
    }

    setMemberActionId(`${member.user._id}:role`);
    try {
      await updateMemberRole(activeGroupId, member.user._id, role);
    } finally {
      setMemberActionId(null);
    }
  };

  const handleKickMember = async (member: GroupMember) => {
    if (!activeGroupId) {
      return;
    }

    if (!window.confirm(`Remove ${member.user.username} from the group?`)) {
      return;
    }

    setMemberActionId(`${member.user._id}:kick`);
    try {
      await kickMember(activeGroupId, member.user._id);
    } finally {
      setMemberActionId(null);
    }
  };

  if (!activeGroup) {
    return (
      <main className="chat-window chat-window--empty">
        <div className="chat-hero">
          <p className="eyebrow">Welcome back</p>
          <h2>
            {user?.username ? `Hello, ${user.username}` : "Choose a group"}
          </h2>
          <p>
            Pick one of your joined groups or join a public community from the
            sidebar to start chatting.
          </p>
          <div className="chat-hero__status">
            <span
              className={
                isConnected ? "status-pill status-pill--online" : "status-pill"
              }
            >
              {isConnected ? "Socket connected" : "Waiting for connection"}
            </span>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="chat-window">
      <header className="chat-window__header">
        <div>
          <p className="eyebrow">Channel</p>
          <h2>{activeGroup.name}</h2>
          <p>
            {activeGroup.description ||
              "A focused space for your team conversation."}
          </p>
        </div>
        <div className="chat-window__header-actions">
          <span className="status-pill status-pill--online">Live</span>
          {currentRole && currentRole !== "owner" ? (
            <button
              type="button"
              className="button button--ghost button--compact"
              onClick={() => void handleLeaveGroup()}
              disabled={isLeaving}
            >
              {isLeaving ? "Leaving..." : "Leave group"}
            </button>
          ) : null}
          {currentRole === "owner" ? (
            <button
              type="button"
              className="button button--danger button--compact"
              onClick={() => void handleDeleteGroup()}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete group"}
            </button>
          ) : null}
        </div>
      </header>

      <section className="group-panel-grid">
        <article className="group-panel">
          <div className="group-panel__header">
            <h3>Group details</h3>
            <span>
              {isLoadingGroupDetails
                ? "Refreshing"
                : `${activeGroup.memberCount ?? activeGroup.members?.length ?? 0} members`}
            </span>
          </div>
          {groupError ? <p className="auth-form__error">{groupError}</p> : null}
          <div className="group-tags">
            <span className="status-pill">{activeGroup.type ?? "public"}</span>
            {(activeGroup.tags ?? []).map((tag) => (
              <span key={tag} className="status-pill">
                #{tag}
              </span>
            ))}
          </div>
          {canAdmin ? (
            <form className="stack-form" onSubmit={handleSaveGroup}>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Group name"
                required
              />
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Describe this group"
                rows={3}
              />
              <input
                value={avatar}
                onChange={(event) => setAvatar(event.target.value)}
                placeholder="Avatar URL"
              />
              <input
                value={tags}
                onChange={(event) => setTags(event.target.value)}
                placeholder="Tags separated by commas"
              />
              <input
                value={maxMembers}
                onChange={(event) => setMaxMembers(event.target.value)}
                inputMode="numeric"
                placeholder="Max members"
              />
              <button
                type="submit"
                className="button button--primary"
                disabled={isSaving || !name.trim()}
              >
                {isSaving ? "Saving..." : "Save group"}
              </button>
              {activeGroup.inviteCode ? (
                <p className="group-panel__meta">
                  Invite code: {activeGroup.inviteCode}
                </p>
              ) : null}
            </form>
          ) : (
            <div className="group-summary">
              <p>{activeGroup.description || "No description yet."}</p>
              {activeGroup.inviteCode ? (
                <p>Invite code: {activeGroup.inviteCode}</p>
              ) : null}
            </div>
          )}
        </article>

        <article className="group-panel">
          <div className="group-panel__header">
            <h3>Members</h3>
            <span>{activeGroup.members?.length ?? 0}</span>
          </div>
          <div className="member-list">
            {(activeGroup.members ?? []).map((member) => {
              const canKick =
                canModerate &&
                member.user._id !== user?._id &&
                !["owner", "admin"].includes(member.role);

              return (
                <div key={member.user._id} className="member-card">
                  <div>
                    <strong>{member.user.username}</strong>
                    <p>
                      {member.role}
                      {member.user.isOnline ? " - online" : ""}
                    </p>
                  </div>
                  <div className="member-card__actions">
                    {canAdmin && member.role !== "owner" ? (
                      <select
                        value={member.role}
                        onChange={(event) =>
                          void handleRoleChange(
                            member,
                            event.target.value as GroupRole,
                          )
                        }
                        disabled={memberActionId === `${member.user._id}:role`}
                      >
                        <option value="member">member</option>
                        <option value="moderator">moderator</option>
                        <option value="admin">admin</option>
                      </select>
                    ) : (
                      <span className="status-pill">{member.role}</span>
                    )}
                    {canKick ? (
                      <button
                        type="button"
                        className="button button--ghost button--compact"
                        onClick={() => void handleKickMember(member)}
                        disabled={memberActionId === `${member.user._id}:kick`}
                      >
                        {memberActionId === `${member.user._id}:kick`
                          ? "Removing..."
                          : "Remove"}
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </article>
      </section>

      <MessageList />
      <MessageInput />
    </main>
  );
}
