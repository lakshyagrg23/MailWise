import React, { useState, useContext } from 'react';
import http from '../api/http';
import {
  Box,
  Typography,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { emailContext } from '../App';

const Auto_email = () => {
    const { setData, setOpenAi } = useContext(emailContext);
    const [type, setType] = useState('formal');
    const [description, setDescription] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!description.trim()) return;

        setLoading(true);
        try {
            const response = await http.post('/fetch-email/email', { type: type, details: description });
            if (response.data) {
                setData(prev => ({ ...prev, ...response.data }));
                setOpenAi(false);
            }
        } catch (error) {
            console.error('Error generating email draft:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box sx={{ p: { xs: 1, sm: 2 }, fontFamily: "'Inter', sans-serif" }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
                <AutoAwesomeIcon sx={{ color: '#2563eb', fontSize: 22 }} />
                <Typography sx={{ fontWeight: 700, fontSize: '18px', color: '#0f172a' }}>
                    AI Draft Assistant
                </Typography>
            </Box>

            <Typography sx={{ fontSize: '13.5px', color: '#64748b', mb: 3 }}>
                Describe the key points or intent of your message, and Gemini will generate a polished draft for you.
            </Typography>

            <form onSubmit={handleSubmit}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                    {/* Tone Selection */}
                    <FormControl size="small" fullWidth>
                        <InputLabel id="tone-label">Tone & Style</InputLabel>
                        <Select
                            labelId="tone-label"
                            value={type}
                            label="Tone & Style"
                            onChange={(e) => setType(e.target.value)}
                            sx={{ borderRadius: 2 }}
                        >
                            <MenuItem value="formal">Formal & Professional</MenuItem>
                            <MenuItem value="informal">Friendly & Casual</MenuItem>
                            <MenuItem value="executive">Executive & Direct</MenuItem>
                            <MenuItem value="inquiry">Sales / Outreach Inquiry</MenuItem>
                        </Select>
                    </FormControl>

                    {/* Intent Description */}
                    <TextField
                        fullWidth
                        multiline
                        minRows={4}
                        label="What should this email say?"
                        placeholder="e.g. Schedule a sync with Sarah on Thursday at 2pm to review Q3 roadmap, ask her to bring the analytics deck."
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        required
                        sx={{
                            "& .MuiOutlinedInput-root": {
                                borderRadius: 2,
                                fontSize: "14px"
                            }
                        }}
                    />

                    {/* Action Button */}
                    <Button
                        type="submit"
                        variant="contained"
                        disabled={loading || !description.trim()}
                        startIcon={loading ? <CircularProgress size={16} sx={{ color: '#ffffff' }} /> : <AutoAwesomeIcon sx={{ fontSize: 16 }} />}
                        sx={{
                            backgroundColor: '#2563eb',
                            py: 1.2,
                            fontWeight: 600,
                            borderRadius: 2,
                            textTransform: 'none',
                            boxShadow: 'none',
                            '&:hover': { backgroundColor: '#1d4ed8' }
                        }}
                    >
                        {loading ? 'Generating Draft...' : 'Generate Draft'}
                    </Button>
                </Box>
            </form>
        </Box>
    );
};

export default Auto_email;
