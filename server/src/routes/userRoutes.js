// server/src/routes/userRoutes.js

import express from "express";

import {
  getUsers,
  getUserById,
  createUser,
  bulkCreateUsers,
  updateUser,
  deleteUser,
  getUsersByDepartment,
  getUsersWithoutFace,
  updateLoginCount,
} from "../controllers/userController.js";

import {
  authenticateToken,
  isAdmin,
} from "../middleware/auth.js";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| Protected User Routes
|--------------------------------------------------------------------------
| All user-management routes require:
| 1. Valid JWT
| 2. Admin role
|--------------------------------------------------------------------------
*/

// Get all users
router.get(
  "/",
  authenticateToken,
  isAdmin,
  getUsers
);

// Get students/users without face registration
// Keep this BEFORE /:id
router.get(
  "/without-face",
  authenticateToken,
  isAdmin,
  getUsersWithoutFace
);

// Get users by department
router.get(
  "/department/:departmentId",
  authenticateToken,
  isAdmin,
  getUsersByDepartment
);

// Get single user
router.get(
  "/:id",
  authenticateToken,
  isAdmin,
  getUserById
);

// Create single user
router.post(
  "/",
  authenticateToken,
  isAdmin,
  createUser
);

// Bulk student import
router.post(
  "/bulk",
  authenticateToken,
  isAdmin,
  bulkCreateUsers
);

// Update user
router.put(
  "/:id",
  authenticateToken,
  isAdmin,
  updateUser
);

// Update login count
router.patch(
  "/:userId/login",
  authenticateToken,
  isAdmin,
  updateLoginCount
);

// Delete user
router.delete(
  "/:id",
  authenticateToken,
  isAdmin,
  deleteUser
);

export default router;