<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /**
     * POST /api/login
     * Body: { "username": "...", "password": "..." }
     * Returns: { token, user: { id, name, username, role: { id, name, permissions[] } } }
     */
    public function login(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'username' => ['required', 'string'],
            'password' => ['required', 'string'],
        ]);

        $user = User::with(['role', 'roles'])->where('username', $credentials['username'])->first();

        if (!$user || !Hash::check($credentials['password'], $user->password)) {
            throw ValidationException::withMessages([
                'username' => ['Invalid username or password.'],
            ]);
        }

        if (!$user->active) {
            throw ValidationException::withMessages([
                'username' => ['This account is inactive. Please contact an administrator.'],
            ]);
        }

        // Issue a new Sanctum token for this device
        $token = $user->createToken('pos-session')->plainTextToken;

        AuditLog::record($user, 'LOGIN', "{$user->name} ({$user->role->name}) signed in");

        return response()->json([
            'token' => $token,
            'user'  => $this->presentUser($user),
        ]);
    }

    /**
     * POST /api/logout
     * Requires bearer token. Revokes the current token.
     */
    public function logout(Request $request): JsonResponse
    {
        $user = $request->user();
        $request->user()->currentAccessToken()->delete();

        AuditLog::record($user, 'LOGOUT', "{$user->name} signed out");

        return response()->json(['message' => 'Signed out.']);
    }

    /**
     * GET /api/me
     * Returns the authenticated user with role + permissions.
     */
    public function me(Request $request): JsonResponse
    {
        $user = $request->user()->load(['role', 'roles']);
        return response()->json(['user' => $this->presentUser($user)]);
    }

    /**
     * Shape the user payload consistently.
     * Returns the primary role (display label) AND the full set of roles
     * the user holds — the frontend uses `permissions` (merged across all
     * roles) for nav-visibility checks.
     */
    private function presentUser(User $user): array
    {
        $allRoles = $user->roles->map(fn ($r) => [
            'id'          => $r->id,
            'name'        => $r->name,
            'permissions' => $r->permissions,
        ])->values();

        // Fallback if no pivot rows exist for some reason
        if ($allRoles->isEmpty() && $user->role) {
            $allRoles = collect([[
                'id'          => $user->role->id,
                'name'        => $user->role->name,
                'permissions' => $user->role->permissions,
            ]]);
        }

        return [
            'id'          => $user->id,
            'name'        => $user->name,
            'username'    => $user->username,
            'email'       => $user->email,
            'phone'       => $user->phone,
            'active'      => $user->active,
            // Primary role — display label (e.g. "Cashier" in sidebar)
            'role'        => $user->role ? [
                'id'          => $user->role->id,
                'name'        => $user->role->name,
                'permissions' => $user->role->permissions,
            ] : null,
            // All roles the user holds
            'roles'       => $allRoles,
            // Merged permission keys across all roles
            'permissions' => $user->permissions(),
        ];
    }
}
