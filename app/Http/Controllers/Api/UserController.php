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
        return response()->json(User::with('role')->orderBy('name')->get());
    }

    /** GET /api/users/{user} */
    public function show(User $user): JsonResponse
    {
        return response()->json($user->load('role'));
    }

    /** POST /api/users */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'     => ['required', 'string', 'max:255'],
            'username' => ['required', 'string', 'max:64', 'unique:users,username'],
            'email'    => ['required', 'email', 'unique:users,email'],
            'phone'    => ['nullable', 'string', 'max:32'],
            'role_id'  => ['required', 'integer', 'exists:roles,id'],
            'password' => ['required', 'string', 'min:6'],
            'active'   => ['nullable', 'boolean'],
        ]);
        $data['password'] = Hash::make($data['password']);
        $data['active'] = $data['active'] ?? true;
        $user = User::create($data);
        AuditLog::record($request->user(), 'USER_CREATED', $user->username);
        return response()->json($user->load('role'), 201);
    }

    /** PUT /api/users/{user} */
    public function update(Request $request, User $user): JsonResponse
    {
        $data = $request->validate([
            'name'     => ['sometimes', 'required', 'string', 'max:255'],
            'username' => ['sometimes', 'required', 'string', 'max:64', 'unique:users,username,' . $user->id],
            'email'    => ['sometimes', 'required', 'email', 'unique:users,email,' . $user->id],
            'phone'    => ['nullable', 'string', 'max:32'],
            'role_id'  => ['sometimes', 'integer', 'exists:roles,id'],
            'password' => ['nullable', 'string', 'min:6'],
            'active'   => ['nullable', 'boolean'],
        ]);
        if (!empty($data['password'])) $data['password'] = Hash::make($data['password']);
        else unset($data['password']);
        $user->update($data);
        AuditLog::record($request->user(), 'USER_UPDATED', $user->username);
        return response()->json($user->load('role'));
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
}
