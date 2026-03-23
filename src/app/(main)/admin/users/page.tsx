"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface User {
  id: string;
  username: string;
  name: string;
  role: string;
  memberRole: string | null;
  skills: string[];
  maxLoad: number;
  status: string;
  createdAt: string;
}

const MEMBER_ROLES = [
  { value: "frontend", label: "前端开发" },
  { value: "backend", label: "后端开发" },
  { value: "fullstack", label: "全栈开发" },
  { value: "test", label: "测试工程师" },
];

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    name: "",
    role: "member",
    memberRole: "frontend",
    skills: "",
    maxLoad: "3",
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      setUsers(data);
    } catch {
      console.error("Failed to fetch users");
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditingUser(null);
    setFormData({
      username: "",
      password: "",
      name: "",
      role: "member",
      memberRole: "frontend",
      skills: "",
      maxLoad: "3",
    });
    setShowModal(true);
  }

  function openEdit(user: User) {
    setEditingUser(user);
    setFormData({
      username: user.username,
      password: "",
      name: user.name,
      role: user.role,
      memberRole: user.memberRole || "frontend",
      skills: (user.skills || []).join(", "),
      maxLoad: String(user.maxLoad || 3),
    });
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingUser(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const method = editingUser ? "PUT" : "POST";
    const skillsArray = formData.skills
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const body: Record<string, unknown> = {
      username: formData.username,
      name: formData.name,
      role: formData.role,
      memberRole: formData.memberRole,
      skills: skillsArray,
      maxLoad: parseInt(formData.maxLoad) || 3,
    };
    if (formData.password) body.password = formData.password;
    if (editingUser) body.id = editingUser.id;

    const res = await fetch("/api/users", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      fetchUsers();
      closeModal();
    } else {
      const data = await res.json();
      alert(data.error || "操作失败");
    }
  }

  async function handleDelete(user: User) {
    if (!confirm(`确定删除用户 "${user.name}" 吗？这将同时删除对应的团队成员信息。`)) return;
    const res = await fetch(`/api/users?id=${user.id}`, { method: "DELETE" });
    if (res.ok) {
      fetchUsers();
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/login", { method: "DELETE" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">用户管理</h1>
        <div className="flex gap-3">
          <button
            onClick={() => router.push("/")}
            className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2"
          >
            返回首页
          </button>
          <button
            onClick={handleLogout}
            className="text-sm text-red-500 hover:text-red-700 px-3 py-2"
          >
            退出登录
          </button>
          <button
            onClick={openCreate}
            className="bg-brand-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-600 transition"
          >
            + 新建用户
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-surface-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-surface-50 border-b border-surface-200">
            <tr>
              <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-6 py-3">姓名</th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-6 py-3">用户名</th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-6 py-3">登录角色</th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-6 py-3">团队角色</th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-6 py-3">技能</th>
              <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wide px-6 py-3">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-gray-400">加载中...</td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-gray-400">暂无用户</td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className="hover:bg-surface-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-brand-100 rounded-full flex items-center justify-center text-brand-600 text-sm font-semibold">
                        {user.name[0]}
                      </div>
                      <span className="text-sm font-medium">{user.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{user.username}</td>
                  <td className="px-6 py-4">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      user.role === "admin" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                    }`}>
                      {user.role === "admin" ? "管理员" : "成员"}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                      {MEMBER_ROLES.find((r) => r.value === user.memberRole)?.label || user.memberRole || "-"}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {(user.skills || []).slice(0, 3).map((skill, i) => (
                        <span key={i} className="text-xs px-1.5 py-0.5 bg-surface-100 text-gray-500 rounded">
                          {skill}
                        </span>
                      ))}
                      {(user.skills || []).length > 3 && (
                        <span className="text-xs text-gray-400">+{user.skills.length - 3}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => openEdit(user)}
                      className="text-xs text-brand-600 hover:text-brand-800 mr-4"
                    >
                      编辑
                    </button>
                    <button
                      onClick={() => handleDelete(user)}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
            <h2 className="text-lg font-semibold mb-4">
              {editingUser ? "编辑用户" : "新建用户"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">姓名</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full border border-surface-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-200"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">用户名</label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="w-full border border-surface-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-200"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">密码 {editingUser && "(留空不修改)"}</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full border border-surface-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-200"
                    placeholder={editingUser ? "••••••••" : ""}
                    required={!editingUser}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">登录角色</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full border border-surface-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-200"
                  >
                    <option value="member">成员</option>
                    <option value="admin">管理员</option>
                  </select>
                </div>
              </div>

              <div className="border-t border-surface-100 pt-4">
                <h3 className="text-sm font-medium text-gray-600 mb-3">团队成员信息</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">团队角色</label>
                    <select
                      value={formData.memberRole}
                      onChange={(e) => setFormData({ ...formData, memberRole: e.target.value })}
                      className="w-full border border-surface-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-200"
                    >
                      {MEMBER_ROLES.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">最大负载</label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={formData.maxLoad}
                      onChange={(e) => setFormData({ ...formData, maxLoad: e.target.value })}
                      className="w-full border border-surface-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-200"
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">技能标签（用逗号分隔）</label>
                  <input
                    type="text"
                    value={formData.skills}
                    onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
                    className="w-full border border-surface-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-200"
                    placeholder="React, TypeScript, Node.js"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand-500 text-white rounded-lg text-sm font-medium hover:bg-brand-600"
                >
                  {editingUser ? "保存" : "创建"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
