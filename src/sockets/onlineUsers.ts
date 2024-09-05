export class OnlineUsers {
  private users = new Map<string, string>();

  addUser(userID: string, socketID: string) {
    this.users.set(userID, socketID);
  }

  removeUser(userID: string) {
    this.users.delete(userID);
  }

  getOnlineUsers() {
    return this.users.keys();
  }

  getUserById(userID: string) {
    return this.users.get(userID);
  }
  getSocketId(userID: string): string | undefined {
    return this.users.get(userID);
  }
  isUserOnline(userID: string): boolean {
    return this.users.has(userID);
  }
}
