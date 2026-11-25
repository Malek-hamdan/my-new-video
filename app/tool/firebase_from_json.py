"""Writes lib/firebase_config.dart from a google-services.json file.

Usage: python3 tool/firebase_from_json.py path/to/google-services.json
"""
import json
import pathlib
import sys

data = json.loads(pathlib.Path(sys.argv[1]).read_text())
info = data["project_info"]
client = next(c for c in data["client"]
              if c["client_info"]["android_client_info"]["package_name"] == "lb.animewear.ledger")
opts = {
    "apiKey": client["api_key"][0]["current_key"],
    "appId": client["client_info"]["mobilesdk_app_id"],
    "messagingSenderId": info["project_number"],
    "projectId": info["project_id"],
    "storageBucket": info.get("storage_bucket", ""),
}
body = ",\n".join(f"  {k}: '{v}'" for k, v in opts.items())
out = pathlib.Path(__file__).resolve().parent.parent / "lib" / "firebase_config.dart"
out.write_text(f"""import 'package:firebase_core/firebase_core.dart';

/// Connection settings for the {opts['projectId']} Firebase project, copied from
/// google-services.json. These values are not secret: anyone who has the APK
/// can read them. Access to the data is controlled by sign-in and the rules
/// in firestore.rules.
const FirebaseOptions? firebaseOptions = FirebaseOptions(
{body},
);
""")
print("wrote", out)
