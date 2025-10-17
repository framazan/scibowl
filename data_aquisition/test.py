import re
import firebase_admin
from firebase_admin import credentials, firestore


def main():
    """
    Count the number of documents in all Firestore collections except 'meta' and 'tournaments'.
    """

    # Initialize Firestore using Application Default Credentials
    if not firebase_admin._apps:
        cred = credentials.ApplicationDefault()
        firebase_admin.initialize_app(cred)

    db = firestore.client()

    # List all top-level collections
    collections = db.collections()
    exclude = {"meta", "tournaments"}
    total_docs = 0
    print("Counting documents in all collections (except 'meta' and 'tournaments'):")
    for col in collections:
        col_id = col.id
        if col_id in exclude:
            continue
        count = sum(1 for _ in col.stream())
        print(f"  {col_id}: {count}")
        total_docs += count
    print(f"Total documents (excluding 'meta' and 'tournaments'): {total_docs}")


if __name__ == "__main__":
    main()
