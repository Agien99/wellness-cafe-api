<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Role;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class UserController extends Controller
{
    /** GET /api/users */
    public function index(): JsonResponse
    {
        return response()->json(
            User::with(['role', 'roles'])->orderBy('name')->get()
        );
    }

    /** GET /api/users/{user} */
    public function show(User $user): JsonResponse
    {
        return response()->json($user->load(['role', 'roles']));
    }

    /** POST /api/users */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'       => ['required', 'string', 'max:255'],
            'username'   => ['required', 'string', 'max:64', 'unique:users,username'],
            'email'      => ['required', 'email', 'unique:users,email'],
            'phone'      => ['nullable', 'string', 'max:32'],
            'role_id'    => ['required', 'integer', 'exists:roles,id'],
            'role_ids'   => ['nullable', 'array'],
            'role_ids.*' => ['integer', 'exists:roles,id'],
            'password'   => ['required', 'string', 'min:6'],
            'active'     => ['nullable', 'boolean'],
        ]);

        $roleIds = $this->buildRoleIds($data);

        $user = User::create([
            'name'     => $data['name'],
            'username' => $data['username'],
            'email'    => $data['email'],
            'phone'    => $data['phone'] ?? null,
            'role_id'  => $data['role_id'],
            'password' => Hash::make($data['password']),
            'active'   => $data['active'] ?? true,
        ]);
        $user->roles()->sync($roleIds);

        AuditLog::record($request->user(), 'USER_CREATED',
            $user->username . ' (' . count($roleIds) . ' role' . (count($roleIds)===1?'':'s') . ')');

        return response()->json($user->load(['role', 'roles']), 201);
    }

    /** PUT /api/users/{user} */
    public function update(Request $request, User $user): JsonResponse
    {
        $data = $request->validate([
            'name'       => ['sometimes', 'required', 'string', 'max:255'],
            'username'   => ['sometimes', 'required', 'string', 'max:64', 'unique:users,username,' . $user->id],
            'email'      => ['sometimes', 'required', 'email', 'unique:users,email,' . $user->id],
            'phone'      => ['nullable', 'string', 'max:32'],
            'role_id'    => ['sometimes', 'integer', 'exists:roles,id'],
            'role_ids'   => ['nullable', 'array'],
            'role_ids.*' => ['integer', 'exists:roles,id'],
            'password'   => ['nullable', 'string', 'min:6'],
            'active'     => ['nullable', 'boolean'],
        ]);

        $writable = $data;
        if (!empty($writable['password'])) $writable['password'] = Hash::make($writable['password']);
        else unset($writable['password']);
        unset($writable['role_ids']);

        $user->update($writable);

        // Sync pivot if either role_ids or role_id was sent
        if (isset($data['role_ids']) || isset($data['role_id'])) {
            $user->roles()->sync($this->buildRoleIds($data, $user));
        }

        AuditLog::record($request->user(), 'USER_UPDATED', $user->username);

        return response()->json($user->fresh()->load(['role', 'roles']));
    }

    /** DELETE /api/users/{user} */
    public function destroy(Request $request, User $user): JsonResponse
    {
        if ($user->id === $request->user()->id) {
            throw ValidationException::withMessages(['user' => ['You cannot delete your own account.']]);
        }
        $username = $user->username;
        $user->delete();
        AuditLog::record($request->user(), 'USER_DELETED', $username);
        return response()->json(['message' => 'Deleted.']);
    }

    /** GET /api/roles */
    public function roles(): JsonResponse
    {
        return response()->json(Role::withCount('users')->get());
    }

    /**
     * Build the final array of role IDs the user should hold.
     * Always includes the primary `role_id` (display label) so the pivot is
     * never out of sync with the user's display role.
     */
    private function buildRoleIds(array $data, ?User $existing = null): array
    {
        $primary = $data['role_id'] ?? $existing?->role_id;
        $ids     = $data['role_ids'] ?? ($existing ? $existing->roles->pluck('id')->all() : []);
        if ($primary) $ids[] = $primary;
        return array_values(array_unique(array_map('intval', $ids)));
    }
}
