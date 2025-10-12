import mongoose from "mongoose";

const gallerySchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: [true, "Image title is required"],
            trim: true
        },
        description: {
            type: String,
            trim: true
        },
        imageUrl: {
            type: String,
            required: [true, "Image URL is required"]
        },
        uploadedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: [true, "Uploader information is required"]
        },
        category: {
            type: String,
            enum: ["course", "event", "facility", "other"],
            default: "other"
        },
        course: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Course"
        },
        isPublic: {
            type: Boolean,
            default: true
        }
    },
    {
        timestamps: true
    }
);

// Static method to get all public images
gallerySchema.statics.getPublicImages = async function() {
    return this.find({ isPublic: true })
        .populate("uploadedBy", "name role")
        .populate("course", "name")
        .sort({ createdAt: -1 });
};

const Gallery = mongoose.model("Gallery", gallerySchema);

export default Gallery; 