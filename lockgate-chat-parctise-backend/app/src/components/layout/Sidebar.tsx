import type { FormEvent } from "react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { disconnectSocket } from "../../socket/socket";
import { useAuthStore } from "../../store/authStore";
import { useChatStore } from "../../store/chatStore";
import { useSocketStore } from "../../store/socketStore";

export default function Sidebar() {
  const user = useAuthStore((state) => state.user);
  const groups = useChatStore((state) => state.groups);
  const discoverGroups = useChatStore((state) => state.discoverGroups);
  const activeGroupId = useChatStore((state) => state.activeGroupId);
  const setActiveGroup = useChatStore((state) => state.setActiveGroup);
  const joinGroup = useChatStore((state) => state.joinGroup);
  const joinByInvite = useChatStore((state) => state.joinByInvite);
  const createGroup = useChatStore((state) => state.createGroup);
  const loadMyGroups = useChatStore((state) => state.loadMyGroups);
  const loadDiscoverGroups = useChatStore((state) => state.loadDiscoverGroups);
  const isLoadingDiscoverGroups = useChatStore(
    (state) => state.isLoadingDiscoverGroups,
  );
  const resetChat = useChatStore((state) => state.resetChat);
  const groupError = useChatStore((state) => state.error);
  const isConnected = useSocketStore((state) => state.isConnected);
  const [search, setSearch] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [groupType, setGroupType] = useState<"public" | "private">("public");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [joining, setJoining] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [joiningInvite, setJoiningInvite] = useState(false);
  const deferredSearch = useDeferredValue(search.trim());

  useEffect(() => {
    void loadDiscoverGroups(deferredSearch || undefined);
  }, [deferredSearch, loadDiscoverGroups]);

  const filteredDiscoverGroups = useMemo(() => {
    const joinedIds = new Set(groups.map((group) => group._id));

    return discoverGroups.filter((group) => {
      if (joinedIds.has(group._id)) return false;
      return true;
    });
  }, [discoverGroups, groups]);

  const handleJoin = async (groupId: string) => {
    setJoining(groupId);
    try {
      await joinGroup(groupId);
      await loadMyGroups();
      await loadDiscoverGroups();
    } finally {
      setJoining(null);
    }
  };

  const handleCreateGroup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreating(true);

    try {
      await createGroup({
        name: name.trim(),
        description: description.trim() || undefined,
        type: groupType,
      });
      setName("");
      setDescription("");
      setGroupType("public");
      setShowCreateForm(false);
      await loadMyGroups();
      await loadDiscoverGroups();
    } catch {
      // Store error is already surfaced in the UI.
    } finally {
      setCreating(false);
    }
  };

  const handleJoinInvite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setJoiningInvite(true);

    try {
      await joinByInvite(inviteCode.trim());
      setInviteCode("");
      await loadMyGroups();
      await loadDiscoverGroups();
    } catch {
      // Store error is already surfaced in the UI.
    } finally {
      setJoiningInvite(false);
    }
  };

  const handleLogout = async () => {
    disconnectSocket();
    resetChat();
    await useAuthStore.getState().logout();
  };

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <div>
          <p className="eyebrow">Lockgate</p>
          <h1 className="sidebar__title">Chat</h1>
        </div>
        <span
          className={
            isConnected ? "status-pill status-pill--online" : "status-pill"
          }
        >
          {isConnected ? "Live" : "Offline"}
        </span>
      </div>

      <div className="sidebar__profile">
        <div className="avatar avatar--lg">
          {user?.avatar ? (
            <img src={user.avatar} alt={user.username} />
          ) : (
            <span>{user?.username?.slice(0, 2).toUpperCase()}</span>
          )}
        </div>
        <div>
          <strong>{user?.username}</strong>
          <p>{user?.bio || "Ready to jump into a conversation."}</p>
        </div>
      </div>

      <label className="search-field">
        <span>Explore groups</span>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by name or topic"
        />
      </label>

      <section className="sidebar__section">
        <div className="sidebar__section-header">
          <h2>Quick actions</h2>
          <button
            type="button"
            className="button button--ghost button--compact"
            onClick={() => setShowCreateForm((current) => !current)}
          >
            {showCreateForm ? "Hide" : "Create"}
          </button>
        </div>

        {showCreateForm ? (
          <form className="stack-form" onSubmit={handleCreateGroup}>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Group name"
              required
            />
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What is this group for?"
              rows={3}
            />
            <select
              value={groupType}
              onChange={(event) =>
                setGroupType(event.target.value as "public" | "private")
              }
            >
              <option value="public">Public group</option>
              <option value="private">Private group</option>
            </select>
            <button
              type="submit"
              className="button button--primary"
              disabled={creating || !name.trim()}
            >
              {creating ? "Creating..." : "Create group"}
            </button>
          </form>
        ) : null}

        <form className="stack-form" onSubmit={handleJoinInvite}>
          <input
            value={inviteCode}
            onChange={(event) => setInviteCode(event.target.value)}
            placeholder="Invite code"
            required
          />
          <button
            type="submit"
            className="button button--secondary"
            disabled={joiningInvite || !inviteCode.trim()}
          >
            {joiningInvite ? "Joining..." : "Join by invite"}
          </button>
        </form>

        {groupError ? <p className="auth-form__error">{groupError}</p> : null}
      </section>

      <section className="sidebar__section">
        <div className="sidebar__section-header">
          <h2>Your groups</h2>
          <span>{groups.length}</span>
        </div>
        <div className="group-list">
          {groups.length === 0 ? (
            <div className="empty-state empty-state--compact">
              <p>No joined groups yet.</p>
              <span>Use the discovery list below to join a public group.</span>
            </div>
          ) : (
            groups.map((group) => (
              <button
                key={group._id}
                type="button"
                className={
                  activeGroupId === group._id
                    ? "group-card group-card--active"
                    : "group-card"
                }
                onClick={() => setActiveGroup(group._id)}
              >
                <div className="group-card__meta">
                  <strong>{group.name}</strong>
                  <span>
                    {group.memberCount ?? group.members?.length ?? 0} members
                  </span>
                </div>
                <p>
                  {group.lastMessage?.content ||
                    group.description ||
                    "No recent messages"}
                </p>
              </button>
            ))
          )}
        </div>
      </section>

      <section className="sidebar__section sidebar__section--scroll">
        <div className="sidebar__section-header">
          <h2>Discover</h2>
          <span>
            {isLoadingDiscoverGroups ? "..." : filteredDiscoverGroups.length}
          </span>
        </div>
        <div className="group-list">
          {isLoadingDiscoverGroups ? (
            <div className="empty-state empty-state--compact">
              <p>Loading public groups.</p>
              <span>Refreshing the discovery feed for your search.</span>
            </div>
          ) : null}
          {!isLoadingDiscoverGroups && filteredDiscoverGroups.length === 0 ? (
            <div className="empty-state empty-state--compact">
              <p>No matching public groups.</p>
              <span>
                Try a different search or create one right here.
              </span>
            </div>
          ) : (
            filteredDiscoverGroups.map((group) => (
              <article
                key={group._id}
                className="group-card group-card--discover"
              >
                <div className="group-card__meta">
                  <strong>{group.name}</strong>
                  <span>{group.type || "public"}</span>
                </div>
                <p>
                  {group.description ||
                    "A public space waiting for new members."}
                </p>
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() => void handleJoin(group._id)}
                  disabled={joining === group._id}
                >
                  {joining === group._id ? "Joining..." : "Join group"}
                </button>
              </article>
            ))
          )}
        </div>
      </section>

      <button
        type="button"
        className="button button--ghost sidebar__logout"
        onClick={() => void handleLogout()}
      >
        Sign out
      </button>
    </aside>
  );
}
