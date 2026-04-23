from sqlmodel import create_engine

def create_db_engine(db_url: str = "sqlite:///./learning_app.db"):
    """
    Create a SQLModel engine for the given database URL.

    Args:
        db_url (str): The database URL to connect to.

    Returns:
        SQLModel: An instance of SQLModel engine.
    """
    engine = create_engine(db_url)
    return engine