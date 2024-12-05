import { Request, Response } from 'express';
import EventPostModel from './event.model';

// Controller for creating a new event post
export const createEventPost = async (req: Request, res: Response): Promise<void> => {
  try {
    const eventData = req.body;
    const newEvent = await EventPostModel.create(eventData);
    res.status(201).json({ success: true, message: 'Event created successfully', data: newEvent });
  } catch (error: any) {
    res.status(400).json({ success: false, message: 'Error creating event', error: error.message });
  }
};

// Controller for fetching all event posts
export const getAllEventPosts = async (_req: Request, res: Response): Promise<void> => {
  try {
    const events = await EventPostModel.find();
    res.status(200).json({ success: true, data: events });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Error fetching events', error: error.message });
  }
};

// Controller for fetching a single event post by ID
export const getEventPostBycommunityId = async (req: Request, res: Response): Promise<void> => {
  try {
    const { communityId } = req.params;
    const event = await EventPostModel.findOne({ communityId });
    if (!event) {
      res.status(404).json({ success: false, message: 'Event not found' });
      return;
    }
    res.status(200).json({ success: true, data: event });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Error fetching event', error: error.message });
  }
};

// Controller for updating an event post
export const updateEventPost = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const updatedEvent = await EventPostModel.findOneAndUpdate({ _id: id }, updates, { new: true });
    if (!updatedEvent) {
      res.status(404).json({ success: false, message: 'Event not found' });
      return;
    }
    res.status(200).json({ success: true, message: 'Event updated successfully', data: updatedEvent });
  } catch (error: any) {
    res.status(400).json({ success: false, message: 'Error updating event', error: error.message });
  }
};

// Controller for deleting an event post
export const deleteEventPost = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const deletedEvent = await EventPostModel.findOneAndDelete({ _id: id });
    if (!deletedEvent) {
      res.status(404).json({ success: false, message: 'Event not found' });
      return;
    }
    res.status(200).json({ success: true, message: 'Event deleted successfully', data: deletedEvent });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Error deleting event', error: error.message });
  }
};

// Controller for filtering event posts by status, tags, or date range
export const filterEventPosts = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, tags, startDate, endDate } = req.query;
    const filters: Record<string, any> = {};

    if (status) filters['status'] = status;
    if (tags) filters['tags'] = { $in: (tags as string).split(',') }; // Splits a comma-separated list of tags
    if (startDate && endDate) {
      filters['eventDateTime'] = {
        $gte: new Date(startDate as string),
        $lte: new Date(endDate as string),
      };
    }

    const filteredEvents = await EventPostModel.find(filters);
    res.status(200).json({ success: true, data: filteredEvents });
  } catch (error: any) {
    res.status(400).json({ success: false, message: 'Error filtering events', error: error.message });
  }
};
