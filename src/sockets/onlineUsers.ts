export class OnlineUsers {
  private users = new Map<string, string>();
  private activeUsers = new Set<string>();

  addUser(userID: string, socketID: string) {
    this.users.set(userID, socketID);
    // active by default
    this.activeUsers.add(userID);
  }

  removeUser(userID: string) {
    this.users.delete(userID);
    this.activeUsers.delete(userID);
  }

  setUserActive(userID: string, isActive: boolean) {
    if (isActive) {
      this.activeUsers.add(userID);
    } else {
      this.activeUsers.delete(userID);
    }
  }

  isUserActive(userID: string): boolean {
    return this.activeUsers.has(userID);
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
