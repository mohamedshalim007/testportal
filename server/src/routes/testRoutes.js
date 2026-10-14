// server/src/routes/testRoutes.js
import express from 'express';
import { db } from '../db.js';
import { authenticateToken, isAdmin, isSelfOrAdmin } from '../middleware/auth.js';

const router = express.Router();

// Default code templates for different languages
const DEFAULT_CODE_TEMPLATES = {
  python: `# Python Program
try:
    name = input("Enter your name: ")
    age = int(input("Enter your age: "))
    print(f"Hello {name}! You are {age} years old.")
except Exception as e:
    print(f"Error: {e}")`,

  c: `#include <stdio.h>

int main() {
    char name[50];
    int age;
    
    printf("Enter your name: ");
    if (scanf("%49s", name) != 1) {
        printf("Error reading name\\n");
        return 1;
    }
    printf("Enter your age: ");
    if (scanf("%d", &age) != 1) {
        printf("Error reading age\\n");
        return 1;
    }
    printf("Hello %s! You are %d years old.\\n", name, age);
    
    return 0;
}`,

  cpp: `#include <iostream>
#include <string>
using namespace std;

int main() {
    string name;
    int age;
    
    cout << "Enter your name: ";
    if (!(cin >> name)) {
        cout << "Error reading name" << endl;
        return 1;
    }
    cout << "Enter your age: ";
    if (!(cin >> age)) {
        cout << "Error reading age" << endl;
        return 1;
    }
    cout << "Hello " << name << "! You are " << age << " years old." << endl;
    
    return 0;
}`,

  java: `import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        try (Scanner sc = new Scanner(System.in)) {
            System.out.print("Enter your name: ");
            String name = sc.nextLine();
            System.out.print("Enter your age: ");
            int age = sc.nextInt();
            System.out.println("Hello " + name + "! You are " + age + " years old.");
        } catch (Exception e) {
            System.err.println("Error: " + e.getMessage());
        }
    }
}`,

  javascript: `// JavaScript Program
const readline = require('readline');
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.question('Enter your name: ', (name) => {
    rl.question('Enter your age: ', (age) => {
        console.log('Hello ' + name + '! You are ' + age + ' years old.');
        rl.close();
    });
});`
};

// ==================== CAMERA VERIFICATION ROUTES ====================

// Get camera verification setting
router.get('/camera-verification', authenticateToken, (req, res) => {
  const { test_id } = req.query;
  
  if (!test_id) {
    return res.status(400).json({ 
      ok: false, 
      error: "Test ID is required" 
    });
  }

  db.query(
    "SELECT camera_verification FROM tests WHERE test_id = ?",
    [test_id],
    (err, rows) => {
      if (err) {
        console.error("Get camera setting error:", err);
        return res.status(500).json({ 
          ok: false, 
          error: err.message 
        });
      }

      const camera_verification = rows.length > 0 ? rows[0].camera_verification : 'no';
      res.json({ 
        ok: true, 
        camera_verification 
      });
    }
  );
});

// Update camera verification setting
router.post('/camera-verification', authenticateToken, isAdmin, (req, res) => {
  const { test_id, camera_verification } = req.body;

  if (!test_id) {
    return res.status(400).json({ 
      ok: false, 
      error: "Test ID is required" 
    });
  }

  db.query(
    `INSERT INTO tests (test_id, camera_verification) 
     VALUES (?, ?) 
     ON DUPLICATE KEY UPDATE camera_verification = ?`,
    [test_id, camera_verification || 'no', camera_verification || 'no'],
    (err, result) => {
      if (err) {
        console.error("Update camera setting error:", err);
        return res.status(500).json({ 
          ok: false, 
          error: err.message 
        });
      }

      res.json({ 
        ok: true, 
        message: "Camera setting updated successfully" 
      });
    }
  );
});

// ==================== COMPILER SETTINGS ROUTES ====================

// ✅ PUBLIC ROUTE - Get compiler setting for students (NO AUTH REQUIRED)
router.get('/compiler-setting/public', (req, res) => {
  const { test_id } = req.query;

  if (!test_id) {
    return res.status(400).json({ 
      ok: false, 
      error: "Test ID is required" 
    });
  }

  db.query(
    `SELECT compiler_visible, compiler_language 
     FROM test_settings 
     WHERE test_id = ?`,
    [test_id],
    (err, rows) => {
      if (err) {
        console.error("Get compiler setting error:", err);
        return res.status(500).json({ 
          ok: false, 
          error: err.message 
        });
      }

      if (rows.length > 0) {
        res.json({ 
          ok: true, 
          compiler_visible: rows[0].compiler_visible || 'no',
          compiler_language: rows[0].compiler_language || 'python'
        });
      } else {
        // Return default settings
        res.json({ 
          ok: true, 
          compiler_visible: 'no',
          compiler_language: 'python'
        });
      }
    }
  );
});

// ✅ ADMIN ROUTE - Get compiler setting (with auth)
router.get('/compiler-setting', authenticateToken, (req, res) => {
  const { test_id } = req.query;

  if (!test_id) {
    return res.status(400).json({ 
      ok: false, 
      error: "Test ID is required" 
    });
  }

  db.query(
    `SELECT compiler_visible, compiler_language 
     FROM test_settings 
     WHERE test_id = ?`,
    [test_id],
    (err, rows) => {
      if (err) {
        console.error("Get compiler setting error:", err);
        return res.status(500).json({ 
          ok: false, 
          error: err.message 
        });
      }

      if (rows.length > 0) {
        res.json({ 
          ok: true, 
          compiler_visible: rows[0].compiler_visible || 'no',
          compiler_language: rows[0].compiler_language || 'python'
        });
      } else {
        // Return default settings
        res.json({ 
          ok: true, 
          compiler_visible: 'no',
          compiler_language: 'python'
        });
      }
    }
  );
});

// ✅ ADMIN ROUTE - Update compiler setting (with auth)
router.post('/compiler-setting', authenticateToken, isAdmin, (req, res) => {
  const { test_id, compiler_visible, compiler_language } = req.body;

  if (!test_id) {
    return res.status(400).json({ 
      ok: false, 
      error: "Test ID is required" 
    });
  }

  // Validate language
  const validLanguages = ['python', 'c', 'cpp', 'java', 'javascript'];
  const language = compiler_language || 'python';
  if (!validLanguages.includes(language)) {
    return res.status(400).json({ 
      ok: false, 
      error: "Invalid compiler language. Supported: python, c, cpp, java, javascript" 
    });
  }

  db.query(
    `INSERT INTO test_settings (test_id, compiler_visible, compiler_language) 
     VALUES (?, ?, ?) 
     ON DUPLICATE KEY UPDATE 
       compiler_visible = ?, 
       compiler_language = ?`,
    [
      test_id, 
      compiler_visible || 'no', 
      language,
      compiler_visible || 'no', 
      language
    ],
    (err, result) => {
      if (err) {
        console.error("Update compiler setting error:", err);
        return res.status(500).json({ 
          ok: false, 
          error: err.message 
        });
      }

      res.json({ 
        ok: true, 
        message: "Compiler setting updated successfully",
        data: {
          test_id,
          compiler_visible: compiler_visible || 'no',
          compiler_language: language
        }
      });
    }
  );
});

// ==================== COMPILER DEFAULT CODE ROUTES ====================

// Get default code for a specific language (public)
router.get('/compiler-default-code/:language', (req, res) => {
  const { language } = req.params;
  
  // Validate language
  const validLanguages = ['python', 'c', 'cpp', 'java', 'javascript'];
  if (!validLanguages.includes(language)) {
    return res.status(400).json({ 
      ok: false, 
      error: "Invalid language. Supported: python, c, cpp, java, javascript" 
    });
  }

  const code = DEFAULT_CODE_TEMPLATES[language] || DEFAULT_CODE_TEMPLATES.python;
  
  res.json({ 
    ok: true, 
    language: language,
    code: code 
  });
});

// Get all default codes for all languages
router.get('/compiler-default-codes', (req, res) => {
  res.json({ 
    ok: true, 
    codes: DEFAULT_CODE_TEMPLATES 
  });
});

// ==================== COMPILER STATUS ROUTE ====================

// Get compiler status (public)
router.get('/compiler-status', (req, res) => {
  res.json({ 
    ok: true, 
    status: {
      available: true,
      languages: ['python', 'c', 'cpp', 'java', 'javascript'],
      defaultLanguage: 'python',
      websocketEndpoint: '/compiler-ws'
    }
  });
});

// ==================== TEST SETTINGS ROUTES ====================

// ✅ PUBLIC ROUTE - Get all test settings (for students)
router.get('/settings/public/:test_id', (req, res) => {
  const { test_id } = req.params;

  if (!test_id) {
    return res.status(400).json({ 
      ok: false, 
      error: "Test ID is required" 
    });
  }

  const query = `
    SELECT 
      t.camera_verification,
      ts.compiler_visible,
      ts.compiler_language
    FROM tests t
    LEFT JOIN test_settings ts ON t.test_id = ts.test_id
    WHERE t.test_id = ?
  `;

  db.query(query, [test_id], (err, rows) => {
    if (err) {
      console.error("Get test settings error:", err);
      return res.status(500).json({ 
        ok: false, 
        error: err.message 
      });
    }

    if (rows.length > 0) {
      res.json({ 
        ok: true, 
        data: {
          camera_verification: rows[0].camera_verification || 'no',
          compiler_visible: rows[0].compiler_visible || 'no',
          compiler_language: rows[0].compiler_language || 'python'
        }
      });
    } else {
      // Return default settings
      res.json({ 
        ok: true, 
        data: {
          camera_verification: 'no',
          compiler_visible: 'no',
          compiler_language: 'python'
        }
      });
    }
  });
});

// ✅ ADMIN ROUTE - Get all test settings (with auth)
router.get('/settings/:test_id', authenticateToken, (req, res) => {
  const { test_id } = req.params;

  if (!test_id) {
    return res.status(400).json({ 
      ok: false, 
      error: "Test ID is required" 
    });
  }

  const query = `
    SELECT 
      t.camera_verification,
      ts.compiler_visible,
      ts.compiler_language
    FROM tests t
    LEFT JOIN test_settings ts ON t.test_id = ts.test_id
    WHERE t.test_id = ?
  `;

  db.query(query, [test_id], (err, rows) => {
    if (err) {
      console.error("Get test settings error:", err);
      return res.status(500).json({ 
        ok: false, 
        error: err.message 
      });
    }

    if (rows.length > 0) {
      res.json({ 
        ok: true, 
        data: {
          camera_verification: rows[0].camera_verification || 'no',
          compiler_visible: rows[0].compiler_visible || 'no',
          compiler_language: rows[0].compiler_language || 'python'
        }
      });
    } else {
      // Return default settings
      res.json({ 
        ok: true, 
        data: {
          camera_verification: 'no',
          compiler_visible: 'no',
          compiler_language: 'python'
        }
      });
    }
  });
});

// Update multiple test settings at once (admin only)
router.post('/settings/:test_id', authenticateToken, isAdmin, (req, res) => {
  const { test_id } = req.params;
  const { camera_verification, compiler_visible, compiler_language } = req.body;

  if (!test_id) {
    return res.status(400).json({ 
      ok: false, 
      error: "Test ID is required" 
    });
  }

  // Validate language if provided
  const validLanguages = ['python', 'c', 'cpp', 'java', 'javascript'];
  const language = compiler_language || 'python';
  if (compiler_language && !validLanguages.includes(compiler_language)) {
    return res.status(400).json({ 
      ok: false, 
      error: "Invalid compiler language. Supported: python, c, cpp, java, javascript" 
    });
  }

  // Start transaction
  db.beginTransaction((err) => {
    if (err) {
      console.error("Transaction begin error:", err);
      return res.status(500).json({ ok: false, error: err.message });
    }

    // Update camera verification in tests table
    if (camera_verification !== undefined) {
      db.query(
        `INSERT INTO tests (test_id, camera_verification) 
         VALUES (?, ?) 
         ON DUPLICATE KEY UPDATE camera_verification = ?`,
        [test_id, camera_verification || 'no', camera_verification || 'no'],
        (err) => {
          if (err) {
            return db.rollback(() => {
              console.error("Update camera error:", err);
              res.status(500).json({ ok: false, error: err.message });
            });
          }
        }
      );
    }

    // Update compiler settings
    if (compiler_visible !== undefined || compiler_language !== undefined) {
      db.query(
        `INSERT INTO test_settings (test_id, compiler_visible, compiler_language) 
         VALUES (?, ?, ?) 
         ON DUPLICATE KEY UPDATE 
           compiler_visible = ?, 
           compiler_language = ?`,
        [
          test_id, 
          compiler_visible || 'no', 
          language,
          compiler_visible || 'no', 
          language
        ],
        (err) => {
          if (err) {
            return db.rollback(() => {
              console.error("Update compiler error:", err);
              res.status(500).json({ ok: false, error: err.message });
            });
          }
        }
      );
    }

    // Commit transaction
    db.commit((err) => {
      if (err) {
        return db.rollback(() => {
          console.error("Commit error:", err);
          res.status(500).json({ ok: false, error: err.message });
        });
      }

      res.json({ 
        ok: true, 
        message: "Test settings updated successfully"
      });
    });
  });
});

export default router;