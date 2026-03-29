import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Notification = Database["public"]["Tables"]["notifications"]["Row"];
type InsertNotification = Database["public"]["Tables"]["notifications"]["Insert"];

export const notificationService = {
  /**
   * Create a new notification
   */
  async createNotification(
    userId: string,
    title: string,
    message: string,
    relatedRequestId?: string
  ): Promise<Notification> {
    const notification: InsertNotification = {
      user_id: userId,
      title,
      message,
      request_id: relatedRequestId,
      is_read: false,
    };

    const { data, error } = await supabase
      .from("notifications")
      .insert(notification)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  },

  /**
   * Get user notifications
   */
  async getUserNotifications(userId: string, limit = 20): Promise<Notification[]> {
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw new Error(error.message);
    return data || [];
  },

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<void> {
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notificationId);

    if (error) throw new Error(error.message);
  },

  /**
   * Mark all user notifications as read
   */
  async markAllAsRead(userId: string): Promise<void> {
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", userId)
      .eq("is_read", false);

    if (error) throw new Error(error.message);
  },

  /**
   * Get unread notifications count
   */
  async getUnreadCount(userId: string): Promise<number> {
    const { count, error } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_read", false);

    if (error) throw new Error(error.message);
    return count || 0;
  },

  /**
   * Send notification to role
   */
  async notifyRole(
    role: string,
    title: string,
    message: string,
    relatedRequestId?: string
  ): Promise<void> {
    // Get all users with this role
    // Using user_roles table which links user_id to role
    const { data: userRoles, error } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", role as any);

    if (error) throw new Error(error.message);

    // Create notification for each user
    const notifications = (userRoles || []).map(ur => ({
      user_id: ur.user_id,
      title,
      message,
      request_id: relatedRequestId,
      is_read: false,
    }));

    if (notifications.length > 0) {
      const { error: insertError } = await supabase
        .from("notifications")
        .insert(notifications);

      if (insertError) throw new Error(insertError.message);
    }
  },
};

export type { Notification, InsertNotification };