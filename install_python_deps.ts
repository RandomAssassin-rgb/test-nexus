import { execSync } from "child_process";
try {
  console.log("Installing pip...");
  execSync("curl -sS https://bootstrap.pypa.io/get-pip.py | python3", { stdio: "inherit" });
  console.log("Installing Python dependencies...");
  execSync("python3 -m pip install fastapi uvicorn scikit-learn xgboost pydantic pandas joblib numpy", { stdio: "inherit" });
  console.log("Training models...");
  execSync("python3 train_models.py", { stdio: "inherit" });
  console.log("Done.");
} catch (e) {
  console.error("Failed to install Python dependencies:", e);
}
