**Git Branch Workflow Instructions (Using `master` + `develop` with Versioned Releases)**

This project uses:

* `master` → stable production-ready code
* `develop` → main development branch
* `feature/...` → individual features
* `release/x.y` → versioned release branches

---

## 🔹 1. Clone the repository (only once)

```bash
git clone <REPO_URL>
cd <REPO_NAME>
```

---

## 🔹 2. Get the latest branches

```bash
git checkout master
git pull origin master
git checkout develop
git pull origin develop
```

---

## 🔹 3. Create your feature branch FROM `develop`

 Always branch off `develop`, NOT `master`

```bash
git checkout develop
git pull origin develop
git checkout -b feature/your-feature-name
```

Example:

```bash
git checkout -b feature/frontend-dashboard
```

---

## 🔹 4. Push your branch to GitHub

```bash
git push -u origin feature/your-feature-name
```

---

## 🔹 5. Work on your code and commit

```bash
git add .
git commit -m "Describe what you added/changed"
git push
```

---

## 🔹 6. Keep your branch updated with `develop`

Do this often to avoid merge conflicts:

```bash
git checkout develop
git pull origin develop
git checkout feature/your-feature-name
git merge develop
```

---

## Creating a Pull Request (Feature → Develop)

1. Go to the GitHub repository
2. Click **"Compare & pull request"** (or go to **Pull Requests → New Pull Request**)
3. Set:

   * **Base branch:** `develop`
   * **Compare branch:** `feature/your-feature-name`
4. Add a title and description
5. Click **"Create Pull Request"**

---

## Merging the Pull Request

1. Review changes
2. Click **"Merge Pull Request"**
3. Click **"Confirm Merge"**
4. Delete the branch after merging (recommended)

---

## Creating a Release Branch (Versioned)

When the team is ready for a release:

```bash
git checkout develop
git pull origin develop
git checkout -b release/1.0
git push -u origin release/1.0
```

Examples:

* `release/1.0`
* `release/1.1`
* `release/2.0`

---

## Release Pull Requests

### 1. Merge release → `master` (production)

* Create PR:

  * **Base:** `master`
  * **Compare:** `release/x.y`
* Merge on GitHub

---

### 2. Merge release → `develop` (keep branches in sync)

* Create another PR:

  * **Base:** `develop`
  * **Compare:** `release/x.y`
* Merge on GitHub

---

## After Release Merge (Everyone MUST do this)

```bash
git checkout master
git pull origin master
git checkout develop
git pull origin develop
```

---

## Branch Naming Examples

* `feature/login-page`
* `feature/course-api`
* `feature/dashboard-ui`
* `release/1.0`
* `release/1.1`
* `bugfix/navbar-error`

---

## Rules to Follow

* NEVER push directly to `master` or `develop`
* ALWAYS branch from `develop`
* ALL feature work goes into `develop` via Pull Requests
* ONLY release branches get merged into `master`
* Keep your branch updated regularly to avoid conflicts

---

Follow this workflow for all development and releases.
